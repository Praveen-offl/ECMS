"""
websocket_manager.py
=====================
Tracks active WebSocket connections and fans out broadcasts to the right
subscribers.

Two independent channel families are supported, matching the Phase 1 API
contract:

    /ws/vitals/{patient_id}        -> anyone watching a specific patient's
                                       live vitals (caregiver dashboard,
                                       possibly multiple tabs/caregivers).
    /ws/alerts/{caregiver_id}      -> a specific caregiver's personal alert
                                       feed, aggregated across all patients
                                       assigned to them.

The manager is intentionally storage-agnostic: it just holds live socket
references in memory. For multi-process/horizontal scaling, this would be
backed by a Redis pub/sub layer instead (each process subscribes to Redis
channels and re-broadcasts to its local sockets) -- noted here as a
production upgrade path but not required for this single-process PBL setup.
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import Dict, Set

from fastapi import WebSocket

logger = logging.getLogger("websocket_manager")


class ConnectionManager:
    """Generic keyed connection registry: one bucket of sockets per key (patient_id or caregiver_id)."""

    def __init__(self) -> None:
        self._connections: Dict[str, Set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, key: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[key].add(websocket)
        logger.info("WS connected: key=%s total_for_key=%d", key, len(self._connections[key]))

    async def disconnect(self, key: str, websocket: WebSocket) -> None:
        async with self._lock:
            conns = self._connections.get(key)
            if conns and websocket in conns:
                conns.remove(websocket)
                if not conns:
                    del self._connections[key]
        logger.info("WS disconnected: key=%s", key)

    async def send_to_key(self, key: str, message: dict) -> None:
        """Broadcast a JSON-serializable message to every socket subscribed to `key`."""
        async with self._lock:
            targets = list(self._connections.get(key, set()))

        if not targets:
            return

        stale: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception as exc:  # connection closed/broken mid-send
                logger.warning("Dropping dead socket for key=%s: %s", key, exc)
                stale.append(ws)

        if stale:
            async with self._lock:
                for ws in stale:
                    self._connections.get(key, set()).discard(ws)

    def connection_count(self, key: str) -> int:
        return len(self._connections.get(key, set()))


class WebSocketHub:
    """
    Aggregates the distinct channel families used by the platform so
    application code has one object to depend on (`app.state.ws_hub`).
    """

    def __init__(self) -> None:
        self.vitals = ConnectionManager()          # keyed by patient_id
        self.alerts = ConnectionManager()           # keyed by caregiver_id
        self.fall_detection = ConnectionManager()    # keyed by patient_id
        self.device_status = ConnectionManager()      # keyed by patient_id

    async def broadcast_vitals(self, patient_id: str, payload: dict) -> None:
        await self.vitals.send_to_key(patient_id, payload)

    async def broadcast_alert_to_caregiver(self, caregiver_id: str, payload: dict) -> None:
        await self.alerts.send_to_key(caregiver_id, payload)

    async def broadcast_fall_event(self, patient_id: str, payload: dict) -> None:
        await self.fall_detection.send_to_key(patient_id, payload)

    async def broadcast_device_status(self, patient_id: str, payload: dict) -> None:
        await self.device_status.send_to_key(patient_id, payload)


# Module-level singleton used by main.py and route/worker modules.
ws_hub = WebSocketHub()
