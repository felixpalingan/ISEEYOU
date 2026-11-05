import asyncio
from typing import Dict, Any, AsyncGenerator
import json


class EventBus:
    """
    Lightweight in-memory and SSE pub-sub stream controller
    """
    def __init__(self):
        self._listeners: Dict[str, asyncio.Queue] = {}

    def subscribe(self, session_id: str) -> asyncio.Queue:
        if session_id not in self._listeners:
            self._listeners[session_id] = asyncio.Queue()
        return self._listeners[session_id]

    async def publish(self, session_id: str, event_type: str, data: Any):
        if session_id in self._listeners:
            payload = {
                "event": event_type,
                "data": data if isinstance(data, dict) else (data.model_dump() if hasattr(data, "model_dump") else str(data))
            }
            await self._listeners[session_id].put(payload)

    def unsubscribe(self, session_id: str):
        if session_id in self._listeners:
            del self._listeners[session_id]


event_bus = EventBus()
