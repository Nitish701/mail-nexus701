import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, Set

from fastapi import WebSocket


class WebSocketBroadcaster:
    """
    Manages all connected SOC dashboard clients.

    Developer 2 responsibilities:
    - Accept WebSocket connections
    - Track active clients
    - Broadcast live security events
    - Remove disconnected clients
    - Prevent one broken connection from
      affecting other connected clients
    """

    def __init__(self) -> None:

        self._connections: Set[WebSocket] = set()

        self._lock = asyncio.Lock()

    # ========================================================
    # CONNECTION MANAGEMENT
    # ========================================================

    async def connect(
        self,
        websocket: WebSocket,
    ) -> None:

        await websocket.accept()

        async with self._lock:

            self._connections.add(
                websocket
            )

    async def disconnect(
        self,
        websocket: WebSocket,
    ) -> None:

        async with self._lock:

            self._connections.discard(
                websocket
            )

    # ========================================================
    # CONNECTION COUNT
    # ========================================================

    async def connection_count(self) -> int:

        async with self._lock:

            return len(
                self._connections
            )

    # ========================================================
    # BROADCAST
    # ========================================================

    async def broadcast(
        self,
        message: Dict[str, Any],
    ) -> None:
        """
        Send one event to every connected SOC client.

        If a client has disconnected, it is removed without
        interrupting delivery to other clients.
        """

        async with self._lock:

            connections = list(
                self._connections
            )

        if not connections:
            return

        results = await asyncio.gather(
            *[
                self._send_safe(
                    websocket,
                    message,
                )
                for websocket in connections
            ],
            return_exceptions=True,
        )

        disconnected = []

        for websocket, result in zip(
            connections,
            results,
        ):

            if isinstance(
                result,
                Exception,
            ):

                disconnected.append(
                    websocket
                )

        if disconnected:

            async with self._lock:

                for websocket in disconnected:

                    self._connections.discard(
                        websocket
                    )

    # ========================================================
    # SAFE SEND
    # ========================================================

    async def _send_safe(
        self,
        websocket: WebSocket,
        message: Dict[str, Any],
    ) -> None:

        await websocket.send_json(
            message
        )


# ============================================================
# GLOBAL BROADCASTER
# ============================================================

broadcaster = WebSocketBroadcaster()


# ============================================================
# UTC TIME HELPER
# ============================================================

def utc_now() -> datetime:

    return datetime.now(
        timezone.utc
    )