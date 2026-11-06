"""
API Routes & Server-Sent Events (SSE) Dispatcher (Task 1.6)
High-performance asynchronous endpoints for scan management, real-time telemetry streaming,
direct-stream CLI access, and operational health monitoring.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from sse_starlette.sse import EventSourceResponse
import uuid
import re
import json
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional

from engine.models.entities import ScanRequest, ScanStatusResponse, EntityType
from engine.core.event_bus import event_bus
from engine.core.base_provider import provider_registry
import engine.providers  # Ensures all provider modules self-register

router = APIRouter()

# Active in-memory session cache for local-first testing
_sessions: Dict[str, Dict[str, Any]] = {}


def classify_input(seed: str) -> EntityType:
    """Classifies raw seed string into supported EntityType"""
    seed = seed.strip()
    # Email regex
    if re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", seed):
        return EntityType.EMAIL
    # IPv4 regex
    if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", seed):
        return EntityType.IP
    # Domain regex
    if re.match(r"^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z]{2,})+$", seed):
        return EntityType.DOMAIN
    # Fallback to username
    return EntityType.USERNAME


async def run_scan_worker(session_id: str, seed: str, entity_type: EntityType):
    """
    Asynchronous pipeline orchestrator:
    - Emits seed identification telemetry
    - Queries provider registry for modules supporting the entity type
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
async def create_scan(request: ScanRequest):
    """
    Initializes a new reconnaissance scan session and launches background workers.
    Returns session metadata immediately with unique session_id.
    """
    session_id = str(uuid.uuid4())
    seed_type = classify_input(request.seed_input)

    session_data = {
        "session_id": session_id,
        "seed_input": request.seed_input,
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
        run_scan_worker(session_id, request.seed_input, seed_type)
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
async def direct_stream_scan(target: str = Query(..., description="Target seed (domain, IP, email, or username)")):
    """
    1-Click direct SSE streaming endpoint.
    Creates an ephemeral session and immediately streams live telemetry without a prior POST call.
    Ideal for CLI tools (curl -N) and fast testing.
    """
    session_id = str(uuid.uuid4())
    seed_type = classify_input(target)

    session_data = {
        "session_id": session_id,
        "seed_input": target,
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

    task = asyncio.create_task(run_scan_worker(session_id, target, seed_type))
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
