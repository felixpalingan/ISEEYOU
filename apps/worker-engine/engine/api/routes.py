from fastapi import APIRouter, HTTPException, BackgroundTasks
from sse_starlette.sse import EventSourceResponse
import uuid
import re
import json
import asyncio
from datetime import datetime

from engine.models.entities import ScanRequest, ScanStatusResponse, EntityType
from engine.core.event_bus import event_bus

router = APIRouter()

# Active in-memory session cache for local-first testing
_sessions = {}


def classify_input(seed: str) -> EntityType:
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
    Simulated scan pipeline for Phase 0 verification (Phase 1 will wire real providers)
    """
    await event_bus.publish(session_id, "log", {
        "timestamp": datetime.utcnow().strftime("%H:%M:%S"),
        "module": "orchestrator",
        "level": "info",
        "message": f"Identified seed input as [{entity_type.upper()}]: {seed}"
    })
    await asyncio.sleep(0.5)

    root_node = {
        "id": f"root-{session_id}",
        "type": entity_type.value,
        "value": seed,
        "label": seed,
        "severity": "info",
        "metadata": {"source": "user_input"},
        "discovered_at": datetime.utcnow().isoformat()
    }
    await event_bus.publish(session_id, "node", root_node)
    
    await event_bus.publish(session_id, "log", {
        "timestamp": datetime.utcnow().strftime("%H:%M:%S"),
        "module": "pipeline",
        "level": "success",
        "message": f"Initial target node spawned on canvas. Ready for modules."
    })
    
    _sessions[session_id]["status"] = "completed"
    _sessions[session_id]["completed_at"] = datetime.utcnow().isoformat()
    await event_bus.publish(session_id, "scan_completed", _sessions[session_id])


@router.post("/scan", response_model=ScanStatusResponse)
async def create_scan(request: ScanRequest, background_tasks: BackgroundTasks):
    session_id = str(uuid.uuid4())
    seed_type = classify_input(request.seed_input)
    
    session_data = {
        "session_id": session_id,
        "seed_input": request.seed_input,
        "seed_type": seed_type,
        "status": "running",
        "risk_score": 0,
        "nodes_count": 1,
        "edges_count": 0,
        "started_at": datetime.utcnow().isoformat(),
        "completed_at": None
    }
    _sessions[session_id] = session_data
    
    background_tasks.add_task(run_scan_worker, session_id, request.seed_input, seed_type)
    return session_data


@router.get("/scan/{session_id}/stream")
async def stream_scan(session_id: str):
    queue = event_bus.subscribe(session_id)
    
    async def event_generator():
        try:
            while True:
                data = await queue.get()
                yield {
                    "event": data.get("event", "message"),
                    "data": json.dumps(data.get("data", {}))
                }
                if data.get("event") in ("scan_completed", "scan_error"):
                    break
        finally:
            event_bus.unsubscribe(session_id)

    return EventSourceResponse(event_generator())


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "iseeyou-worker-engine",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "0.1.0"
    }
