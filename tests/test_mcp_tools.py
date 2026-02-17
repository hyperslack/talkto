"""Happy-path tests for all 14 MCP tool handlers.

These tests call the MCP tool handler functions directly (via `tool.fn`)
against a real in-memory SQLite database. The production `async_session`
is monkeypatched to use the test session factory so service-layer code
operates on the test DB.

Broadcasting and agent invocation are mocked out — we're testing the
data flow, not the WebSocket/HTTP side-effects.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.channel import Channel
from backend.app.models.user import User
from tests.conftest import (
    create_channel,
    create_user,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_broadcast():
    """Mock broadcast_event to be a no-op."""
    with patch("backend.app.services.broadcaster.broadcast_event", new_callable=AsyncMock) as m:
        yield m


@pytest.fixture
def mock_invoke():
    """Mock spawn_background_task and invoke_for_message to be no-ops."""
    with (
        patch(
            "backend.app.services.message_service.spawn_background_task",
            side_effect=lambda coro: coro.close(),  # Close the coroutine to avoid warnings
        ) as mock_spawn,
        patch(
            "backend.app.services.message_service.invoke_for_message",
            new_callable=AsyncMock,
        ),
    ):
        yield mock_spawn


@pytest.fixture
def mock_auto_discover():
    """Mock auto_discover to return None (no real OpenCode process)."""
    with patch(
        "backend.app.services.agent_registry.auto_discover",
        new_callable=AsyncMock,
        return_value=None,
    ) as m:
        yield m


@pytest.fixture
def mock_derive_project():
    """Mock _derive_project_name to avoid git subprocess calls."""
    with patch(
        "backend.app.services.agent_registry._derive_project_name",
        new_callable=AsyncMock,
        return_value="test-project",
    ) as m:
        yield m


@pytest.fixture
def mock_session(db: AsyncSession):
    """Monkeypatch async_session to use the test DB session.

    The service functions (agent_registry, message_router, channel_manager)
    use ``async with async_session() as db:`` internally. This fixture
    replaces that factory so they operate on the test in-memory DB.
    """

    class _FakeSessionCtx:
        """Context manager that yields the test session."""

        def __init__(self):
            self._session = db

        async def __aenter__(self):
            return self._session

        async def __aexit__(self, *args):
            # Don't close — the test fixture manages the session lifecycle
            pass

    def _fake_factory():
        return _FakeSessionCtx()

    with (
        patch("backend.app.services.agent_registry.async_session", _fake_factory),
        patch("backend.app.services.message_router.async_session", _fake_factory),
        patch("backend.app.services.channel_manager.async_session", _fake_factory),
    ):
        yield db


@pytest.fixture
def fake_ctx():
    """Create a fake MCP Context with a session_id."""
    ctx = MagicMock()
    ctx.session_id = f"test-session-{uuid.uuid4().hex[:8]}"
    return ctx


@pytest.fixture
async def general_channel(db: AsyncSession) -> Channel:
    """Create a #general channel (required for registration)."""
    return await create_channel(db, name="#general", channel_type="general")


@pytest.fixture
async def human_user(db: AsyncSession) -> User:
    """Create a human operator user (used for prompt rendering)."""
    return await create_user(
        db, name="yash", user_type="human", display_name="Yash", about="Test operator"
    )


# ---------------------------------------------------------------------------
# Helper: register an agent through the MCP tool
# ---------------------------------------------------------------------------


async def _register_agent(
    fake_ctx,
    project_path: str = "/tmp/test-project",
) -> dict:
    """Call the register MCP tool and return the result."""
    from backend.mcp_server import register

    return await register.fn(
        session_id=f"ses_test_{id(fake_ctx):x}",
        project_path=project_path,
        agent_name=None,
        server_url=None,
        ctx=fake_ctx,
    )


# ---------------------------------------------------------------------------
# 1. register()
# ---------------------------------------------------------------------------


async def test_register_creates_agent(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """register() should create a new agent with a unique name and return prompts."""
    result = await _register_agent(fake_ctx)

    assert "error" not in result
    assert "agent_name" in result
    assert "master_prompt" in result
    assert "inject_prompt" in result
    assert result["project_channel"] == "#project-test-project"

    # Verify the agent was persisted in DB
    from sqlalchemy import select

    from backend.app.models.agent import Agent

    agent_result = await db.execute(select(Agent).where(Agent.agent_name == result["agent_name"]))
    agent = agent_result.scalar_one_or_none()
    assert agent is not None
    assert agent.status == "online"
    assert agent.agent_type == "opencode"


async def test_register_requires_session_id(fake_ctx):
    """register() should reject calls without session_id."""
    from backend.mcp_server import register

    result = await register.fn(
        session_id="",
        project_path="/tmp",
        ctx=fake_ctx,
    )
    assert "error" in result
    assert "session_id is required" in result["error"]


async def test_register_rejects_empty_session_id(fake_ctx):
    """register() should reject whitespace-only session_id."""
    from backend.mcp_server import register

    result = await register.fn(
        session_id="   ",
        project_path="/tmp",
        ctx=fake_ctx,
    )
    assert "error" in result


# ---------------------------------------------------------------------------
# 2. reconnect via register(agent_name=...)
# ---------------------------------------------------------------------------


async def test_reconnect_existing_agent(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """register(agent_name=...) should reconnect an existing agent and return prompts."""
    # First register
    reg = await _register_agent(fake_ctx)
    agent_name = reg["agent_name"]

    from backend.mcp_server import register

    result = await register.fn(
        session_id="ses_reconnect123",
        project_path="/tmp/test-project",
        agent_name=agent_name,
        server_url=None,
        ctx=fake_ctx,
    )

    assert "error" not in result
    assert result["status"] == "connected"
    assert result["agent_name"] == agent_name
    assert "master_prompt" in result


async def test_reconnect_nonexistent_creates_new(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
):
    """register(agent_name="nonexistent") should create a new agent (not error)."""
    from backend.mcp_server import register

    result = await register.fn(
        session_id="ses_test_new",
        project_path="/tmp/test-project",
        agent_name="nonexistent-agent",
        server_url=None,
        ctx=fake_ctx,
    )

    # Should create a new agent since the name doesn't exist
    assert "error" not in result
    assert "agent_name" in result


# ---------------------------------------------------------------------------
# 3. disconnect()
# ---------------------------------------------------------------------------


async def test_disconnect_agent(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """disconnect() should mark agent as offline."""
    reg = await _register_agent(fake_ctx)
    agent_name = reg["agent_name"]

    from backend.mcp_server import disconnect

    result = await disconnect.fn(agent_name=agent_name, ctx=fake_ctx)

    assert "error" not in result
    assert result["status"] == "disconnected"

    # Verify agent is offline in DB
    from sqlalchemy import select

    from backend.app.models.agent import Agent

    agent_result = await db.execute(select(Agent).where(Agent.agent_name == agent_name))
    agent = agent_result.scalar_one_or_none()
    assert agent.status == "offline"


async def test_disconnect_no_session():
    """disconnect() with no agent_name and no session should return error."""
    from backend.mcp_server import disconnect

    result = await disconnect.fn(agent_name=None, ctx=None)
    assert "error" in result


# ---------------------------------------------------------------------------
# 4. send_message()
# ---------------------------------------------------------------------------


async def test_send_message(
    mock_session,
    mock_broadcast,
    mock_invoke,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """send_message() should persist a message and return its ID."""
    await _register_agent(fake_ctx)

    from backend.mcp_server import send_message

    result = await send_message.fn(
        channel="#general",
        content="Hello from test!",
        mentions=None,
        ctx=fake_ctx,
    )

    assert "error" not in result
    assert "message_id" in result
    assert result["channel"] == "#general"

    # Verify message is in DB
    from sqlalchemy import select

    from backend.app.models.message import Message

    msg_result = await db.execute(select(Message).where(Message.id == result["message_id"]))
    msg = msg_result.scalar_one_or_none()
    assert msg is not None
    assert msg.content == "Hello from test!"


async def test_send_message_with_mentions(
    mock_session,
    mock_broadcast,
    mock_invoke,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """send_message() with mentions should persist mention data."""
    await _register_agent(fake_ctx)

    from backend.mcp_server import send_message

    result = await send_message.fn(
        channel="#general",
        content="Hey @cosmic-penguin!",
        mentions=["cosmic-penguin"],
        ctx=fake_ctx,
    )

    assert "error" not in result

    # Verify mentions persisted
    import json

    from sqlalchemy import select

    from backend.app.models.message import Message

    msg_result = await db.execute(select(Message).where(Message.id == result["message_id"]))
    msg = msg_result.scalar_one_or_none()
    assert msg is not None
    parsed_mentions = json.loads(msg.mentions)
    assert "cosmic-penguin" in parsed_mentions


async def test_send_message_not_registered():
    """send_message() without registration should return error."""
    from backend.mcp_server import send_message

    result = await send_message.fn(channel="#general", content="hi", ctx=None)
    assert "error" in result


async def test_send_message_nonexistent_channel(
    mock_session,
    mock_broadcast,
    mock_invoke,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """send_message() to a nonexistent channel should return error."""
    await _register_agent(fake_ctx)

    from backend.mcp_server import send_message

    result = await send_message.fn(
        channel="#nonexistent",
        content="Hello?",
        ctx=fake_ctx,
    )

    assert "error" in result


# ---------------------------------------------------------------------------
# 5. get_messages()
# ---------------------------------------------------------------------------


async def test_get_messages_empty(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """get_messages() should return empty list when no messages exist."""
    await _register_agent(fake_ctx)

    from backend.mcp_server import get_messages

    result = await get_messages.fn(channel="#general", limit=10, ctx=fake_ctx)

    assert "error" not in result
    assert "messages" in result
    assert isinstance(result["messages"], list)


async def test_get_messages_returns_sent_message(
    mock_session,
    mock_broadcast,
    mock_invoke,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """get_messages() should return messages that were sent."""
    await _register_agent(fake_ctx)

    from backend.mcp_server import get_messages, send_message

    # Send a message
    await send_message.fn(
        channel="#general",
        content="Test message content",
        ctx=fake_ctx,
    )

    # Retrieve it
    result = await get_messages.fn(channel="#general", limit=10, ctx=fake_ctx)

    assert "error" not in result
    assert len(result["messages"]) >= 1
    assert any(m["content"] == "Test message content" for m in result["messages"])


async def test_get_messages_priority_retrieval(
    mock_session,
    mock_broadcast,
    mock_invoke,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """get_messages() without channel should use priority retrieval."""
    reg = await _register_agent(fake_ctx)
    reg["agent_name"]

    from backend.mcp_server import get_messages, send_message

    # Send a message to #general
    await send_message.fn(
        channel="#general",
        content="General message",
        ctx=fake_ctx,
    )

    # Get messages without specifying channel (priority mode)
    result = await get_messages.fn(channel=None, limit=10, ctx=fake_ctx)

    assert "error" not in result
    assert "messages" in result


async def test_get_messages_not_registered():
    """get_messages() without registration should return error."""
    from backend.mcp_server import get_messages

    result = await get_messages.fn(ctx=None)
    assert "error" in result


# ---------------------------------------------------------------------------
# 6. create_channel()
# ---------------------------------------------------------------------------


async def test_create_channel(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """create_channel() should create a new channel."""
    await _register_agent(fake_ctx)

    from backend.mcp_server import create_channel as mcp_create_channel

    result = await mcp_create_channel.fn(name="test-channel", ctx=fake_ctx)

    assert "error" not in result
    assert result["name"] == "#test-channel"
    assert result["type"] == "custom"


async def test_create_channel_duplicate(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """create_channel() with existing name should return error."""
    await _register_agent(fake_ctx)

    from backend.mcp_server import create_channel as mcp_create_channel

    # #general already exists
    result = await mcp_create_channel.fn(name="#general", ctx=fake_ctx)

    assert "error" in result
    assert "already exists" in result["error"]


# ---------------------------------------------------------------------------
# 7. join_channel()
# ---------------------------------------------------------------------------


async def test_join_channel(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """join_channel() should add agent to a channel."""
    await _register_agent(fake_ctx)

    # Create a separate channel to join
    await create_channel(db, name="#random", channel_type="general")
    await db.flush()

    from backend.mcp_server import join_channel

    result = await join_channel.fn(channel="#random", ctx=fake_ctx)

    assert "error" not in result
    assert result["status"] == "joined"


async def test_join_channel_already_member(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """join_channel() when already a member should return already_member."""
    await _register_agent(fake_ctx)

    from backend.mcp_server import join_channel

    # Agent is auto-joined to #general on registration
    result = await join_channel.fn(channel="#general", ctx=fake_ctx)

    assert result["status"] == "already_member"


async def test_join_channel_not_registered():
    """join_channel() without registration should return error."""
    from backend.mcp_server import join_channel

    result = await join_channel.fn(channel="#general", ctx=None)
    assert "error" in result


# ---------------------------------------------------------------------------
# 8. list_channels()
# ---------------------------------------------------------------------------


async def test_list_channels(
    mock_session,
    mock_broadcast,
    general_channel,
    db: AsyncSession,
):
    """list_channels() should return all channels."""
    from backend.mcp_server import list_channels

    result = await list_channels.fn()

    assert isinstance(result, list)
    assert len(result) >= 1
    names = [ch["name"] for ch in result]
    assert "#general" in names


# ---------------------------------------------------------------------------
# 9. list_agents()
# ---------------------------------------------------------------------------


async def test_list_agents(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """list_agents() should return registered agents."""
    reg = await _register_agent(fake_ctx)
    agent_name = reg["agent_name"]

    from backend.mcp_server import list_agents

    result = await list_agents.fn()

    assert isinstance(result, list)
    assert len(result) >= 1
    agent_names = [a["name"] for a in result]
    assert agent_name in agent_names


# ---------------------------------------------------------------------------
# 10. update_profile()
# ---------------------------------------------------------------------------


async def test_update_profile(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """update_profile() should update agent profile fields."""
    await _register_agent(fake_ctx)

    from backend.mcp_server import update_profile

    result = await update_profile.fn(
        description="I test things",
        personality="Dry wit and sarcasm",
        current_task="Writing tests",
        gender="non-binary",
        ctx=fake_ctx,
    )

    assert "error" not in result
    assert result["status"] == "updated"
    assert result["description"] == "I test things"
    assert result["personality"] == "Dry wit and sarcasm"
    assert result["current_task"] == "Writing tests"
    assert result["gender"] == "non-binary"


async def test_update_profile_invalid_gender(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """update_profile() should reject invalid gender values."""
    await _register_agent(fake_ctx)

    from backend.mcp_server import update_profile

    result = await update_profile.fn(
        gender="invalid",
        ctx=fake_ctx,
    )

    assert "error" in result


async def test_update_profile_not_registered():
    """update_profile() without registration should return error."""
    from backend.mcp_server import update_profile

    result = await update_profile.fn(description="test", ctx=None)
    assert "error" in result


# ---------------------------------------------------------------------------
# 11. create_feature_request()
# ---------------------------------------------------------------------------


async def test_create_feature_request(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """create_feature_request() should create a new feature."""
    await _register_agent(fake_ctx)

    from backend.mcp_server import create_feature_request

    result = await create_feature_request.fn(
        title="Test Feature",
        description="A feature for testing",
        ctx=fake_ctx,
    )

    assert "error" not in result
    assert result["status"] == "created"
    assert result["title"] == "Test Feature"
    assert "feature_id" in result


async def test_create_feature_request_not_registered():
    """create_feature_request() without registration should return error."""
    from backend.mcp_server import create_feature_request

    result = await create_feature_request.fn(title="X", description="Y", ctx=None)
    assert "error" in result


# ---------------------------------------------------------------------------
# 12. vote_feature()
# ---------------------------------------------------------------------------


async def test_vote_feature(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """vote_feature() should cast a vote on a feature request."""
    await _register_agent(fake_ctx)

    from backend.mcp_server import create_feature_request, vote_feature

    # Create a feature first
    feat = await create_feature_request.fn(
        title="Vote Test Feature",
        description="Feature to test voting",
        ctx=fake_ctx,
    )
    feature_id = feat["feature_id"]

    # Vote on it
    result = await vote_feature.fn(
        feature_id=feature_id,
        vote=1,
        ctx=fake_ctx,
    )

    assert "error" not in result
    assert result["status"] == "voted"
    assert result["vote"] == 1
    assert result["vote_count"] == 1


async def test_vote_feature_downvote(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """vote_feature() with -1 should register a downvote."""
    await _register_agent(fake_ctx)

    from backend.mcp_server import create_feature_request, vote_feature

    feat = await create_feature_request.fn(
        title="Downvote Test",
        description="Feature to test downvoting",
        ctx=fake_ctx,
    )

    result = await vote_feature.fn(
        feature_id=feat["feature_id"],
        vote=-1,
        ctx=fake_ctx,
    )

    assert "error" not in result
    assert result["vote"] == -1
    assert result["vote_count"] == -1


async def test_vote_feature_invalid_vote():
    """vote_feature() with invalid vote value should return error."""
    from backend.mcp_server import vote_feature

    result = await vote_feature.fn(feature_id="x", vote=0, ctx=None)
    assert "error" in result


async def test_vote_feature_nonexistent(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """vote_feature() on nonexistent feature should return error."""
    await _register_agent(fake_ctx)

    from backend.mcp_server import vote_feature

    result = await vote_feature.fn(
        feature_id="nonexistent-id",
        vote=1,
        ctx=fake_ctx,
    )

    assert "error" in result


# ---------------------------------------------------------------------------
# 13. get_feature_requests()
# ---------------------------------------------------------------------------


async def test_get_feature_requests_empty(
    mock_session,
    mock_broadcast,
    db: AsyncSession,
):
    """get_feature_requests() should return empty when no features exist."""
    from backend.mcp_server import get_feature_requests

    result = await get_feature_requests.fn()

    assert "features" in result
    assert isinstance(result["features"], list)


async def test_get_feature_requests_with_data(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """get_feature_requests() should return created features."""
    await _register_agent(fake_ctx)

    from backend.mcp_server import create_feature_request, get_feature_requests

    await create_feature_request.fn(
        title="Feature One",
        description="First feature",
        ctx=fake_ctx,
    )
    await create_feature_request.fn(
        title="Feature Two",
        description="Second feature",
        ctx=fake_ctx,
    )

    result = await get_feature_requests.fn()

    assert "features" in result
    assert len(result["features"]) == 2
    titles = [f["title"] for f in result["features"]]
    assert "Feature One" in titles
    assert "Feature Two" in titles


# ---------------------------------------------------------------------------
# 14. heartbeat()
# ---------------------------------------------------------------------------


async def test_heartbeat(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """heartbeat() should return ok for a registered agent."""
    await _register_agent(fake_ctx)

    from backend.mcp_server import heartbeat

    result = await heartbeat.fn(ctx=fake_ctx)

    assert "error" not in result
    assert result["status"] == "ok"


async def test_heartbeat_not_registered():
    """heartbeat() without registration should return error."""
    from backend.mcp_server import heartbeat

    result = await heartbeat.fn(ctx=None)
    assert "error" in result


# ---------------------------------------------------------------------------
# Session store behavior
# ---------------------------------------------------------------------------


async def test_session_store_persists_identity(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    fake_ctx,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """After register(), the session store should remember the agent name."""
    from backend.mcp_server import _get_agent

    # Before registration, no agent
    assert _get_agent(fake_ctx) is None

    reg = await _register_agent(fake_ctx)

    # After registration, session store has the agent name
    assert _get_agent(fake_ctx) == reg["agent_name"]


async def test_multiple_registrations_different_names(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """Multiple register() calls should create agents with different names."""
    ctx1 = MagicMock()
    ctx1.session_id = f"session-{uuid.uuid4().hex[:8]}"
    ctx2 = MagicMock()
    ctx2.session_id = f"session-{uuid.uuid4().hex[:8]}"

    reg1 = await _register_agent(ctx1)
    reg2 = await _register_agent(ctx2)

    assert reg1["agent_name"] != reg2["agent_name"]
