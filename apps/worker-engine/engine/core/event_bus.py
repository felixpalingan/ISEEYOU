"""
Event Bus & SSE Stream Dispatcher (Task 1.6)
High-performance pub/sub dispatcher supporting multiple listeners per session,
historical event replay for late-connecting clients, and heartbeat keep-alives.
"""

import asyncio
from typing import Dict, Any, List, Optional
import json
import logging
from datetime import datetime

logger = logging.getLogger("iseeyou.event_bus")


class EventBus:
    """
    Lightweight in-memory pub-sub dispatcher for real-time SSE streaming.
    Features:
    - Multiple subscribers per session
    - Historical event replay buffer to eliminate race conditions
    - Graceful cancellation and task tracking
    """

    def __init__(self, max_history_per_session: int = 500):
        self.max_history = max_history_per_session
        self._subscribers: Dict[str, List[asyncio.Queue]] = {}
        self._history: Dict[str, List[Dict[str, Any]]] = {}
        self._active_tasks: Dict[str, asyncio.Task] = {}

    def subscribe(self, session_id: str) -> asyncio.Queue:
        """
        Subscribes a client to a session stream.
        Pre-populates the queue with historical events already emitted.
        """
        queue = asyncio.Queue()

        if session_id not in self._subscribers:
            self._subscribers[session_id] = []
        self._subscribers[session_id].append(queue)

        # Replay past events to ensure late subscribers miss nothing
        if session_id in self._history:
            for past_event in self._history[session_id]:
                queue.put_nowait(past_event)

        logger.debug(
            f"Client subscribed to session {session_id} (Total listeners: {len(self._subscribers[session_id])})"
        )
        return queue

    async def publish(self, session_id: str, event_type: str, data: Any):
        """
        Publishes an event to all active subscribers of a session and saves to history
        """
        payload = {
            "event": event_type,
            "data": (
                data
                if isinstance(data, dict)
                else (data.model_dump() if hasattr(data, "model_dump") else str(data))
            ),
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Append to historical replay buffer
        if session_id not in self._history:
            self._history[session_id] = []

        if len(self._history[session_id]) < self.max_history:
            self._history[session_id].append(payload)

        # Distribute to all active subscriber queues
        if session_id in self._subscribers:
            for queue in list(self._subscribers[session_id]):
                await queue.put(payload)

    def unsubscribe(self, session_id: str, queue: asyncio.Queue):
        """Unregisters a specific subscriber queue"""
        if session_id in self._subscribers:
            if queue in self._subscribers[session_id]:
                self._subscribers[session_id].remove(queue)
            if not self._subscribers[session_id]:
                del self._subscribers[session_id]

    def register_task(self, session_id: str, task: asyncio.Task):
        """Registers a background scan task for lifecycle control"""
        self._active_tasks[session_id] = task

    def cancel_task(self, session_id: str) -> bool:
        """Cancels a running scan task"""
        if session_id in self._active_tasks:
            task = self._active_tasks[session_id]
            if not task.done():
                task.cancel()
                logger.info(f"Cancelled active scan task for session {session_id}")
                return True
        return False

    def get_history(self, session_id: str) -> List[Dict[str, Any]]:
        """Returns the event history buffer for a session"""
        return self._history.get(session_id, [])

    def cleanup_session(self, session_id: str):
        """Removes all subscriber queues and histories for a session"""
        self._subscribers.pop(session_id, None)
        self._history.pop(session_id, None)
        self._active_tasks.pop(session_id, None)

    def clear_all(self):
        """Resets the entire event bus (primarily for testing)"""
        self._subscribers.clear()
        self._history.clear()
        self._active_tasks.clear()


# Global Singleton Event Bus
event_bus = EventBus()
