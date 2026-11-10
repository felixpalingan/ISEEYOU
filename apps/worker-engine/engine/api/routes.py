"""
API Routes & Server-Sent Events (SSE) Dispatcher (Task 1.6)
High-performance asynchronous endpoints for scan management, real-time telemetry streaming,
direct-stream CLI access, and operational health monitoring.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Query, Request
from sse_starlette.sse import EventSourceResponse
import uuid
import re
import json
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional, List

from engine.models.entities import (
    ScanRequest,
    ScanStatusResponse,
    EntityType,
    AIAnalysisRequest,
    AIAnalysisResponse,
)
from engine.core.event_bus import event_bus
from engine.core.base_provider import provider_registry
from engine.services.ai_analyst import ai_analyst_service
from engine.core.security import (
    validate_target_security,
    SecurityValidationError,
    scan_rate_limiter,
    extract_client_ip,
)
import engine.providers  # Ensures all provider modules self-register

router = APIRouter()


class SessionStore:
    """
    Bounded in-memory session store with LRU capacity limits and TTL eviction.
    Prevents memory exhaustion on long-running OSINT worker nodes.
    Automatically coordinates with EventBus to clean up orphaned SSE history buffers.
    """

    def __init__(self, max_capacity: int = 100, default_ttl_seconds: int = 7200):
        self.max_capacity = max_capacity
        self.default_ttl_seconds = default_ttl_seconds
        self._store: Dict[str, Dict[str, Any]] = {}

    def get(self, session_id: str, default: Any = None) -> Any:
        self.evict_expired()
        return self._store.get(session_id, default)

    def __contains__(self, session_id: str) -> bool:
        self.evict_expired()
        return session_id in self._store

    def __getitem__(self, session_id: str) -> Dict[str, Any]:
        return self._store[session_id]

    def __setitem__(self, session_id: str, data: Dict[str, Any]):
        self.evict_expired()
        if len(self._store) >= self.max_capacity and session_id not in self._store:
            self._prune_lru()
        self._store[session_id] = data

    def __len__(self) -> int:
        return len(self._store)

    def delete(self, session_id: str):
        if session_id in self._store:
            del self._store[session_id]
            event_bus.cleanup_session(session_id)

    def _prune_lru(self):
        candidates = [
            sid
            for sid, s in self._store.items()
            if s.get("status") in ("completed", "cancelled", "error")
        ]
        if not candidates:
            candidates = list(self._store.keys())

        if candidates:
            oldest_sid = candidates[0]
            del self._store[oldest_sid]
            event_bus.cleanup_session(oldest_sid)

    def evict_expired(self):
        now = datetime.utcnow()
        to_evict = []
        for sid, s in list(self._store.items()):
            if s.get("status") in ("completed", "cancelled", "error"):
                completed_at_str = s.get("completed_at") or s.get("started_at")
                if completed_at_str:
                    try:
                        t = datetime.fromisoformat(completed_at_str)
                        if (now - t).total_seconds() > self.default_ttl_seconds:
                            to_evict.append(sid)
                    except (ValueError, TypeError):
                        pass
        for sid in to_evict:
            self.delete(sid)

    def clear(self):
        for sid in list(self._store.keys()):
            event_bus.cleanup_session(sid)
        self._store.clear()


# Bounded session store instance (max 100 active/recent sessions, 2 hour TTL)
_sessions = SessionStore(max_capacity=100, default_ttl_seconds=7200)



KNOWN_TLDS = {
    "com", "org", "net", "edu", "gov", "mil", "int", "io", "ai", "co", "id", "dev", "app", "me",
    "info", "biz", "tech", "xyz", "cloud", "site", "online", "store", "top", "pro", "live", "club",
    "space", "agency", "digital", "life", "network", "world", "global", "media", "news", "press",
    "cc", "tv", "ws", "fm", "to", "gg", "is", "sh", "ly", "so",
    "uk", "us", "ca", "de", "fr", "jp", "au", "ru", "cn", "in", "br", "nl", "se", "ch", "es",
    "sg", "my", "kr", "vn", "th", "ph", "nz", "za", "mx", "ar", "cl", "it", "pl", "eu", "no",
    "fi", "dk", "be", "at", "cz", "ro", "gr", "pt", "tr", "ua", "hk", "tw", "ie", "il",
}


def classify_input(seed: str, explicit_type: Optional[EntityType] = None) -> EntityType:
    """Classifies raw seed string into supported EntityType, respecting explicit client type override."""
    if explicit_type:
        return explicit_type

    seed = seed.strip()
    if not seed:
        return EntityType.USERNAME

    # Explicit handle prefix
    if seed.startswith("@"):
        return EntityType.USERNAME

    # Phone number check (+62..., 08..., or international with + and digits)
    cleaned_digits = re.sub(r"[\s\-\(\)\.]", "", seed)
    if (seed.startswith("+") and cleaned_digits[1:].isdigit() and 7 <= len(cleaned_digits[1:]) <= 15) or (
        cleaned_digits.isdigit() and cleaned_digits.startswith("08") and 10 <= len(cleaned_digits) <= 14
    ):
        return EntityType.PHONE

    # Full name with spaces -> Username
    if " " in seed:
        return EntityType.USERNAME

    # Email regex
    if re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", seed):
        return EntityType.EMAIL

    # IPv4 regex
    if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", seed):
        return EntityType.IP

    # Domain regex: must match domain syntax AND terminate with recognized public TLD
    if re.match(r"^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9-]+)+$", seed):
        tld = seed.split(".")[-1].lower()
        if tld in KNOWN_TLDS:
            return EntityType.DOMAIN
        # Usernames with dots like 'john.doe', 'bariq.hkp', 'budi.santoso' are not domains
        return EntityType.USERNAME

    # Fallback to username
    return EntityType.USERNAME


async def run_scan_worker(
    session_id: str,
    seed: str,
    entity_type: EntityType,
    enabled_modules: Optional[List[str]] = None,
):
    """
    Asynchronous pipeline orchestrator:
    - Emits seed identification telemetry
    - Queries provider registry for modules supporting the entity type
    - Filters by enabled_modules when specified by modular scan toggles
    - Sequentially executes providers and streams real-time SSE events
    - Tracks aggregate metrics (nodes, edges, risk score)
    - Signals scan completion
    """
    try:
        await event_bus.publish(
            session_id,
            "log",
            {
                "timestamp": datetime.utcnow().strftime("%H:%M:%S"),
                "module": "orchestrator",
                "level": "info",
                "message": f"Identified seed input as [{entity_type.value.upper()}]: {seed}",
            },
        )

        providers = provider_registry.get_providers_for_type(entity_type)
        if enabled_modules is not None:
            providers = [p for p in providers if p.name in enabled_modules]
            await event_bus.publish(
                session_id,
                "log",
                {
                    "timestamp": datetime.utcnow().strftime("%H:%M:%S"),
                    "module": "orchestrator",
                    "level": "info",
                    "message": f"Modular filter active -> Executing {len(providers)} selected module(s): {', '.join(p.name for p in providers) or 'none'}",
                },
            )

        if not providers:
            await event_bus.publish(
                session_id,
                "log",
                {
                    "timestamp": datetime.utcnow().strftime("%H:%M:%S"),
                    "module": "orchestrator",
                    "level": "warn",
                    "message": f"No active OSINT providers registered for entity type '{entity_type.value}'.",
                },
            )
        else:
            for provider in providers:
                try:
                    async for event in provider.execute(seed, entity_type, session_id):
                        event_type = event.get("type", "log")
                        data = event.get("data", {})

                        if session_id in _sessions:
                            if event_type == "node":
                                _sessions[session_id]["nodes_count"] += 1
                            elif event_type == "edge":
                                _sessions[session_id]["edges_count"] += 1
                            elif event_type == "summary":
                                impact = data.get("risk_score_impact", 0)
                                _sessions[session_id]["risk_score"] = min(
                                    100, _sessions[session_id]["risk_score"] + impact
                                )

                        await event_bus.publish(session_id, event_type, data)
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    await event_bus.publish(
                        session_id,
                        "log",
                        {
                            "timestamp": datetime.utcnow().strftime("%H:%M:%S"),
                            "module": provider.name,
                            "level": "error",
                            "message": f"Module error: {str(e)}",
                        },
                    )

        if session_id in _sessions:
            _sessions[session_id]["status"] = "completed"
            _sessions[session_id]["completed_at"] = datetime.utcnow().isoformat()
            await event_bus.publish(session_id, "scan_completed", _sessions[session_id])

        await event_bus.publish(
            session_id,
            "log",
            {
                "timestamp": datetime.utcnow().strftime("%H:%M:%S"),
                "module": "orchestrator",
                "level": "success",
                "message": (
                    f"Scan completed. Total nodes: {_sessions.get(session_id, {}).get('nodes_count', 0)}, "
                    f"Risk Score: {_sessions.get(session_id, {}).get('risk_score', 0)}/100"
                ),
            },
        )

    except asyncio.CancelledError:
        if session_id in _sessions:
            _sessions[session_id]["status"] = "cancelled"
            _sessions[session_id]["completed_at"] = datetime.utcnow().isoformat()
        await event_bus.publish(
            session_id,
            "scan_error",
            {"message": "Scan execution cancelled by user request."},
        )


@router.post("/scan", response_model=ScanStatusResponse)
async def create_scan(request: ScanRequest, req: Request):
    """
    Initializes a new reconnaissance scan session and launches background workers.
    Enforces Anti-SSRF sanitization, loopback blocking, and sliding-window rate limiting.
    Returns session metadata immediately with unique session_id.
    """
    client_ip = extract_client_ip(req)
    allowed, retry_after = scan_rate_limiter.is_allowed(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Too many scans requested from {client_ip}. Please retry in {retry_after}s.",
            headers={"Retry-After": str(retry_after)},
        )

    try:
        clean_target = validate_target_security(request.seed_input)
    except SecurityValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    session_id = str(uuid.uuid4())
    seed_type = request.entity_type or classify_input(clean_target)

    session_data = {
        "session_id": session_id,
        "seed_input": clean_target,
        "seed_type": seed_type,
        "status": "running",
        "risk_score": 0,
        "nodes_count": 0,
        "edges_count": 0,
        "started_at": datetime.utcnow().isoformat(),
        "completed_at": None,
    }
    _sessions[session_id] = session_data

    # Launch task with lifecycle tracking in EventBus
    task = asyncio.create_task(
        run_scan_worker(session_id, clean_target, seed_type, request.enabled_modules)
    )
    event_bus.register_task(session_id, task)

    return session_data


@router.get("/scan/{session_id}")
async def get_scan_status(session_id: str):
    """Retrieves current session status and aggregate risk metrics"""
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Scan session not found")
    return _sessions[session_id]


@router.post("/scan/{session_id}/cancel")
async def cancel_scan(session_id: str):
    """Gracefully terminates an ongoing scan worker"""
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Scan session not found")

    cancelled = event_bus.cancel_task(session_id)
    return {"session_id": session_id, "cancelled": cancelled}


@router.get("/scan/{session_id}/stream")
async def stream_scan(session_id: str):
    """
    Streams live telemetry events (logs, nodes, edges, findings) via Server-Sent Events (SSE).
    Replays past events if client connects after worker begins.
    """
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Scan session not found")

    queue = event_bus.subscribe(session_id)

    async def event_generator():
        try:
            while True:
                data = await queue.get()
                yield {
                    "event": data.get("event", "message"),
                    "data": json.dumps(data.get("data", {})),
                }
                if data.get("event") in ("scan_completed", "scan_error"):
                    break
        finally:
            event_bus.unsubscribe(session_id, queue)

    return EventSourceResponse(event_generator(), ping=15)


@router.get("/scan/stream/direct")
async def direct_stream_scan(
    req: Request,
    target: str = Query(..., description="Target seed (domain, IP, email, or username)"),
    entity_type: Optional[EntityType] = Query(None, description="Explicit entity type override"),
):
    """
    1-Click direct SSE streaming endpoint.
    Creates an ephemeral session and immediately streams live telemetry without a prior POST call.
    Enforces Anti-SSRF validation, loopback blocking, and IP rate limiting.
    Ideal for CLI tools (curl -N) and fast testing.
    """
    client_ip = extract_client_ip(req)
    allowed, retry_after = scan_rate_limiter.is_allowed(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Please retry in {retry_after}s.",
            headers={"Retry-After": str(retry_after)},
        )

    try:
        clean_target = validate_target_security(target)
    except SecurityValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    session_id = str(uuid.uuid4())
    seed_type = entity_type or classify_input(clean_target)

    session_data = {
        "session_id": session_id,
        "seed_input": clean_target,
        "seed_type": seed_type,
        "status": "running",
        "risk_score": 0,
        "nodes_count": 0,
        "edges_count": 0,
        "started_at": datetime.utcnow().isoformat(),
        "completed_at": None,
    }
    _sessions[session_id] = session_data

    queue = event_bus.subscribe(session_id)

    task = asyncio.create_task(run_scan_worker(session_id, clean_target, seed_type))
    event_bus.register_task(session_id, task)

    async def event_generator():
        try:
            while True:
                data = await queue.get()
                yield {
                    "event": data.get("event", "message"),
                    "data": json.dumps(data.get("data", {})),
                }
                if data.get("event") in ("scan_completed", "scan_error"):
                    break
        finally:
            event_bus.unsubscribe(session_id, queue)

    return EventSourceResponse(event_generator(), ping=15)


@router.post("/analyze/ai", response_model=AIAnalysisResponse)
async def analyze_attack_surface(req: AIAnalysisRequest):
    """
    AI Recon Analyst endpoint (Task 4.1).
    Processes target graph, findings, and infrastructure topology to produce
    an Executive Summary + MITRE ATT&CK Chain Hypothesis.
    """
    return await ai_analyst_service.analyze(req)


@router.get("/health")
async def health_check():
    """Operational health status and registered reconnaissance providers"""
    active_providers = [
        {"name": p.name, "display_name": p.display_name, "supported_types": [t.value for t in p.supported_types]}
        for p in provider_registry.get_all()
    ]
    return {
        "status": "healthy",
        "service": "iseeyou-worker-engine",
        "version": "0.1.0",
        "active_modules_count": len(active_providers),
        "modules": active_providers,
        "timestamp": datetime.utcnow().isoformat(),
    }
