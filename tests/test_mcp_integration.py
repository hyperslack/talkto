"""MCP integration tests — mount the MCP app and call tools via HTTP.

Tests the full register → send → get flow through the REST API (which uses
the same services as the MCP tools), and verifies MCP tool handlers return
structured dicts.
"""

import json
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import (
    create_channel,
    create_channel_member,
    create_user,
)


async def _setup_human_and_channel(db: AsyncSession) -> tuple:
    """Create a human user and #general channel."""
    user = await create_user(db, name="yash", user_type="human", display_name="Yash")
    channel = await create_channel(db, name="#general")
    return user, channel


# ---------------------------------------------------------------------------
# MCP endpoint reachability
# ---------------------------------------------------------------------------


async def test_mcp_endpoint_mounted(client: AsyncClient):
    """The /mcp endpoint should be mounted (not return 404)."""
    resp = await client.post("/mcp", content=b"{}", headers={"Content-Type": "application/json"})
    assert resp.status_code != 404


# ---------------------------------------------------------------------------
# Full register → send → get flow via REST API
# ---------------------------------------------------------------------------


@patch("backend.app.api.messages.create_msg", new_callable=AsyncMock)
async def test_send_and_get_messages(mock_create, client: AsyncClient, db: AsyncSession):
    """Test sending and retrieving messages via REST API endpoints."""
    user, channel = await _setup_human_and_channel(db)
    await db.flush()

    # Create a message directly (not through the patched endpoint)
    from tests.conftest import create_message

    msg = await create_message(
        db, channel_id=channel.id, sender_id=user.id, content="Hello from test!"
    )
    await db.flush()

    # Get messages
    resp = await client.get(f"/api/channels/{channel.id}/messages")
    assert resp.status_code == 200
    messages = resp.json()
    assert len(messages) >= 1
    assert any(m["content"] == "Hello from test!" for m in messages)


async def test_register_send_get_flow(client: AsyncClient, db: AsyncSession):
    """Test the full register → send → get flow using REST API.

    This exercises the same code paths that MCP tools use.
    """
    user, channel = await _setup_human_and_channel(db)
    await db.flush()

    # Send a message via REST API (which uses message_service internally)
    resp = await client.post(
        f"/api/channels/{channel.id}/messages",
        json={"content": "Hello from MCP integration test!", "mentions": []},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["content"] == "Hello from MCP integration test!"
    message_id = data["id"]

    # Retrieve messages
    resp = await client.get(f"/api/channels/{channel.id}/messages")
    assert resp.status_code == 200
    messages = resp.json()
    assert any(m["id"] == message_id for m in messages)


async def test_send_message_with_mentions(client: AsyncClient, db: AsyncSession):
    """Test sending a message with mentions."""
    user, channel = await _setup_human_and_channel(db)
    await db.flush()

    resp = await client.post(
        f"/api/channels/{channel.id}/messages",
        json={"content": "Hey @someone!", "mentions": ["someone"]},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["mentions"] == ["someone"]


# ---------------------------------------------------------------------------
# MCP tool handlers return structured dicts (not JSON strings)
# ---------------------------------------------------------------------------


async def test_mcp_tools_return_dicts():
    """Verify MCP tool handlers return dicts/lists, not JSON strings."""
    from backend.mcp_server import (
        disconnect,
        get_messages,
        heartbeat,
        register,
        send_message,
        vote_feature,
    )

    # Access the underlying async functions via .fn (fastmcp wraps them)
    _disconnect = disconnect.fn
    _send_message = send_message.fn
    _get_messages = get_messages.fn
    _heartbeat = heartbeat.fn
    _vote_feature = vote_feature.fn
    _register = register.fn

    # Tools that require no session should return error dicts
    result = await _disconnect(agent_name=None, ctx=None)
    assert isinstance(result, dict)
    assert "error" in result

    result = await _send_message(channel="#test", content="hi", ctx=None)
    assert isinstance(result, dict)
    assert "error" in result

    result = await _get_messages(ctx=None)
    assert isinstance(result, dict)
    assert "error" in result

    result = await _heartbeat(ctx=None)
    assert isinstance(result, dict)
    assert "error" in result

    result = await _vote_feature(feature_id="x", vote=1, ctx=None)
    assert isinstance(result, dict)
    assert "error" in result

    # Invalid vote
    result = await _vote_feature(feature_id="x", vote=0, ctx=None)
    assert isinstance(result, dict)
    assert "error" in result

    # Invalid agent_type
    result = await _register(agent_type="invalid", project_path="/tmp", ctx=None)
    assert isinstance(result, dict)
    assert "error" in result
