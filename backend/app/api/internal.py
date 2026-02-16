"""Internal endpoints not exposed to frontend.

These endpoints are used for cross-process communication,
specifically for the MCP server to trigger WebSocket broadcasts.
"""
from fastapi import APIRouter, Request

from backend.app.services.ws_manager import ws_manager

router = APIRouter(prefix="/_internal", tags=["internal"])


@router.post("/broadcast")
async def broadcast_event(request: Request) -> dict:
    """Receive a broadcast event from the MCP process and push to WebSocket clients.

    This is an internal-only endpoint. No auth needed since we're local-only.
    """
    event = await request.json()
    await ws_manager.broadcast(event)
    return {"status": "ok"}
