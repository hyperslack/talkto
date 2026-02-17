"""End-to-end flow tests — multi-agent lifecycle scenarios.

Tests complete workflows: register → send → get → disconnect, with
multiple agents interacting. Uses the same monkeypatching strategy
as test_mcp_tools.py to route service-layer DB access through the
test in-memory SQLite database.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.agent import Agent
from backend.app.models.channel import Channel
from backend.app.models.user import User
from tests.conftest import (
    create_channel,
    create_user,
)

# ---------------------------------------------------------------------------
# Fixtures (same pattern as test_mcp_tools.py)
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_broadcast():
    with patch("backend.app.services.broadcaster.broadcast_event", new_callable=AsyncMock) as m:
        yield m


@pytest.fixture
def mock_invoke():
    with (
        patch(
            "backend.app.services.message_service.spawn_background_task",
            side_effect=lambda coro: coro.close(),
        ),
        patch(
            "backend.app.services.message_service.invoke_for_message",
            new_callable=AsyncMock,
        ),
    ):
        yield


@pytest.fixture
def mock_auto_discover():
    with patch(
        "backend.app.services.agent_registry.auto_discover",
        new_callable=AsyncMock,
        return_value=None,
    ):
        yield


@pytest.fixture
def mock_derive_project():
    with patch(
        "backend.app.services.agent_registry._derive_project_name",
        new_callable=AsyncMock,
        return_value="test-project",
    ):
        yield


@pytest.fixture
def mock_session(db: AsyncSession):
    class _FakeSessionCtx:
        def __init__(self):
            self._session = db

        async def __aenter__(self):
            return self._session

        async def __aexit__(self, *args):
            pass

    def _fake_factory():
        return _FakeSessionCtx()

    with (
        patch("backend.app.services.agent_registry.async_session", _fake_factory),
        patch("backend.app.services.message_router.async_session", _fake_factory),
        patch("backend.app.services.channel_manager.async_session", _fake_factory),
    ):
        yield db


def _make_ctx() -> MagicMock:
    ctx = MagicMock()
    ctx.session_id = f"session-{uuid.uuid4().hex[:8]}"
    return ctx


@pytest.fixture
async def general_channel(db: AsyncSession) -> Channel:
    return await create_channel(db, name="#general", channel_type="general")


@pytest.fixture
async def human_user(db: AsyncSession) -> User:
    return await create_user(
        db, name="yash", user_type="human", display_name="Yash", about="Operator"
    )


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


async def _register(ctx, agent_type="claude", project_path="/tmp/test-project") -> dict:
    from backend.mcp_server import register

    return await register.fn(
        agent_type=agent_type,
        project_path=project_path,
        session_id=None,
        server_url=None,
        ctx=ctx,
    )


# ---------------------------------------------------------------------------
# E2E: Full agent lifecycle
# ---------------------------------------------------------------------------


async def test_full_agent_lifecycle(
    mock_session,
    mock_broadcast,
    mock_invoke,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """register → send_message → get_messages → update_profile → heartbeat → disconnect."""
    from backend.mcp_server import (
        disconnect,
        get_messages,
        heartbeat,
        send_message,
        update_profile,
    )

    ctx = _make_ctx()

    # 1. Register
    reg = await _register(ctx)
    assert "error" not in reg
    name = reg["agent_name"]

    # 2. Send a message
    send_result = await send_message.fn(channel="#general", content="I'm alive!", ctx=ctx)
    assert "error" not in send_result
    msg_id = send_result["message_id"]

    # 3. Get messages — should see our own message
    get_result = await get_messages.fn(channel="#general", limit=10, ctx=ctx)
    assert "error" not in get_result
    assert any(m["id"] == msg_id for m in get_result["messages"])

    # 4. Update profile
    profile_result = await update_profile.fn(
        description="Testing bot",
        personality="Methodical",
        current_task="Running E2E tests",
        ctx=ctx,
    )
    assert profile_result["status"] == "updated"

    # 5. Heartbeat
    hb_result = await heartbeat.fn(ctx=ctx)
    assert hb_result["status"] == "ok"

    # 6. Disconnect
    dc_result = await disconnect.fn(agent_name=name, ctx=ctx)
    assert dc_result["status"] == "disconnected"

    # Verify offline in DB
    agent_result = await db.execute(select(Agent).where(Agent.agent_name == name))
    assert agent_result.scalar_one().status == "offline"


# ---------------------------------------------------------------------------
# E2E: Two agents communicate
# ---------------------------------------------------------------------------


async def test_two_agents_communicate(
    mock_session,
    mock_broadcast,
    mock_invoke,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """Agent A sends message, Agent B retrieves it."""
    from backend.mcp_server import get_messages, send_message

    ctx_a = _make_ctx()
    ctx_b = _make_ctx()

    # Register two agents
    reg_a = await _register(ctx_a)
    reg_b = await _register(ctx_b)
    reg_a["agent_name"]
    name_b = reg_b["agent_name"]

    # Agent A sends a message
    send = await send_message.fn(
        channel="#general",
        content=f"Hello @{name_b}, let's collaborate!",
        mentions=[name_b],
        ctx=ctx_a,
    )
    assert "error" not in send

    # Agent B retrieves messages from #general
    msgs = await get_messages.fn(channel="#general", limit=10, ctx=ctx_b)
    assert "error" not in msgs
    assert any(f"Hello @{name_b}" in m["content"] for m in msgs["messages"])

    # Agent B sees the mention in priority retrieval (no channel specified)
    priority_msgs = await get_messages.fn(channel=None, limit=10, ctx=ctx_b)
    assert "error" not in priority_msgs
    # The mention-based priority should find the message
    mention_msgs = [m for m in priority_msgs["messages"] if m.get("priority") == "mention"]
    assert len(mention_msgs) >= 1
    assert any(name_b in (m.get("mentions") or []) for m in mention_msgs)


# ---------------------------------------------------------------------------
# E2E: Register → disconnect → reconnect
# ---------------------------------------------------------------------------


async def test_register_disconnect_reconnect(
    mock_session,
    mock_broadcast,
    mock_invoke,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """Agent registers, disconnects, then reconnects with connect()."""
    from backend.mcp_server import connect, disconnect, send_message

    ctx1 = _make_ctx()

    # Register
    reg = await _register(ctx1)
    name = reg["agent_name"]

    # Send a message while online
    await send_message.fn(channel="#general", content="Before disconnect", ctx=ctx1)

    # Disconnect
    dc = await disconnect.fn(agent_name=name, ctx=ctx1)
    assert dc["status"] == "disconnected"

    # Verify offline
    agent_result = await db.execute(select(Agent).where(Agent.agent_name == name))
    assert agent_result.scalar_one().status == "offline"

    # Reconnect with new context (simulating new terminal session)
    ctx2 = _make_ctx()
    conn = await connect.fn(
        agent_name=name,
        session_id="ses_new123",
        server_url=None,
        ctx=ctx2,
    )
    assert conn["status"] == "connected"
    assert conn["agent_name"] == name
    assert "master_prompt" in conn

    # Verify back online
    agent_result2 = await db.execute(select(Agent).where(Agent.agent_name == name))
    assert agent_result2.scalar_one().status == "online"


# ---------------------------------------------------------------------------
# E2E: Agent creates and joins custom channel
# ---------------------------------------------------------------------------


async def test_create_and_use_custom_channel(
    mock_session,
    mock_broadcast,
    mock_invoke,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """Agent creates a custom channel, sends and retrieves messages there."""
    from backend.mcp_server import (
        create_channel as mcp_create_channel,
    )
    from backend.mcp_server import (
        get_messages,
        join_channel,
        send_message,
    )

    ctx = _make_ctx()
    await _register(ctx)

    # Create custom channel
    ch = await mcp_create_channel.fn(name="dev-chat", ctx=ctx)
    assert "error" not in ch
    assert ch["name"] == "#dev-chat"

    # Join it
    join = await join_channel.fn(channel="#dev-chat", ctx=ctx)
    assert join["status"] == "joined"

    # Send message there
    send = await send_message.fn(
        channel="#dev-chat",
        content="Custom channel works!",
        ctx=ctx,
    )
    assert "error" not in send

    # Retrieve messages from custom channel
    msgs = await get_messages.fn(channel="#dev-chat", limit=10, ctx=ctx)
    assert "error" not in msgs
    assert any(m["content"] == "Custom channel works!" for m in msgs["messages"])


# ---------------------------------------------------------------------------
# E2E: Feature request lifecycle
# ---------------------------------------------------------------------------


async def test_feature_request_lifecycle(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """Create feature → vote up → vote down → verify counts."""
    from backend.mcp_server import (
        create_feature_request,
        get_feature_requests,
        vote_feature,
    )

    ctx_a = _make_ctx()
    ctx_b = _make_ctx()

    # Register two agents
    await _register(ctx_a)
    await _register(ctx_b)

    # Agent A creates a feature
    feat = await create_feature_request.fn(
        title="Auto-testing",
        description="Run tests automatically on every message",
        ctx=ctx_a,
    )
    assert feat["status"] == "created"
    fid = feat["feature_id"]

    # Agent A upvotes
    v1 = await vote_feature.fn(feature_id=fid, vote=1, ctx=ctx_a)
    assert v1["vote_count"] == 1

    # Agent B upvotes
    v2 = await vote_feature.fn(feature_id=fid, vote=1, ctx=ctx_b)
    assert v2["vote_count"] == 2

    # Agent B changes to downvote
    v3 = await vote_feature.fn(feature_id=fid, vote=-1, ctx=ctx_b)
    assert v3["vote_count"] == 0  # +1 from A, -1 from B = 0

    # Verify through get_feature_requests
    feats = await get_feature_requests.fn()
    matching = [f for f in feats["features"] if f["id"] == fid]
    assert len(matching) == 1
    assert matching[0]["vote_count"] == 0
    assert matching[0]["title"] == "Auto-testing"


# ---------------------------------------------------------------------------
# E2E: Multiple agents on same project
# ---------------------------------------------------------------------------


async def test_multiple_agents_same_project(
    mock_session,
    mock_broadcast,
    mock_invoke,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """Multiple agents register on the same project, each gets a unique name."""
    ctx1 = _make_ctx()
    ctx2 = _make_ctx()
    ctx3 = _make_ctx()

    reg1 = await _register(ctx1, project_path="/tmp/myproject")
    reg2 = await _register(ctx2, project_path="/tmp/myproject")
    reg3 = await _register(ctx3, project_path="/tmp/myproject")

    names = {reg1["agent_name"], reg2["agent_name"], reg3["agent_name"]}
    assert len(names) == 3  # All unique

    # All share the same project channel
    assert reg1["project_channel"] == reg2["project_channel"] == reg3["project_channel"]


# ---------------------------------------------------------------------------
# E2E: Cross-channel message retrieval
# ---------------------------------------------------------------------------


async def test_cross_channel_message_retrieval(
    mock_session,
    mock_broadcast,
    mock_invoke,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """Agent gets messages from different channels via priority retrieval."""
    from backend.mcp_server import (
        create_channel as mcp_create_channel,
    )
    from backend.mcp_server import (
        get_messages,
        join_channel,
        send_message,
    )

    ctx_a = _make_ctx()
    ctx_b = _make_ctx()

    await _register(ctx_a)
    reg_b = await _register(ctx_b)
    reg_b["agent_name"]

    # Create and join extra channel
    await mcp_create_channel.fn(name="extras", ctx=ctx_a)
    await join_channel.fn(channel="#extras", ctx=ctx_b)

    # Agent A sends messages in both channels
    await send_message.fn(channel="#general", content="General msg", ctx=ctx_a)
    await send_message.fn(channel="#extras", content="Extras msg", ctx=ctx_a)

    # Agent B retrieves from #general specifically
    gen_msgs = await get_messages.fn(channel="#general", limit=10, ctx=ctx_b)
    assert any(m["content"] == "General msg" for m in gen_msgs["messages"])

    # Agent B retrieves from #extras specifically
    ext_msgs = await get_messages.fn(channel="#extras", limit=10, ctx=ctx_b)
    assert any(m["content"] == "Extras msg" for m in ext_msgs["messages"])


# ---------------------------------------------------------------------------
# E2E: Connect preserves profile after disconnect
# ---------------------------------------------------------------------------


async def test_connect_preserves_profile(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """Profile data survives disconnect/reconnect cycle."""
    from backend.mcp_server import connect, disconnect, update_profile

    ctx1 = _make_ctx()
    reg = await _register(ctx1)
    name = reg["agent_name"]

    # Set profile
    await update_profile.fn(
        description="Test bot",
        personality="Witty",
        current_task="Testing",
        gender="female",
        ctx=ctx1,
    )

    # Disconnect
    await disconnect.fn(agent_name=name, ctx=ctx1)

    # Reconnect
    ctx2 = _make_ctx()
    conn = await connect.fn(agent_name=name, session_id=None, server_url=None, ctx=ctx2)

    assert conn["status"] == "connected"
    assert conn["profile"] is not None
    assert conn["profile"]["description"] == "Test bot"
    assert conn["profile"]["personality"] == "Witty"
    assert conn["profile"]["current_task"] == "Testing"
    assert conn["profile"]["gender"] == "female"


# ---------------------------------------------------------------------------
# E2E: List agents shows all registered agents with status
# ---------------------------------------------------------------------------


async def test_list_agents_shows_status(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """list_agents reflects online/offline status changes."""
    from backend.mcp_server import disconnect, list_agents

    ctx_a = _make_ctx()
    ctx_b = _make_ctx()

    reg_a = await _register(ctx_a)
    reg_b = await _register(ctx_b)
    name_a = reg_a["agent_name"]
    name_b = reg_b["agent_name"]

    # Both online
    agents = await list_agents.fn()
    statuses = {a["name"]: a["status"] for a in agents}
    assert statuses[name_a] == "online"
    assert statuses[name_b] == "online"

    # Disconnect Agent A
    await disconnect.fn(agent_name=name_a, ctx=ctx_a)

    agents = await list_agents.fn()
    statuses = {a["name"]: a["status"] for a in agents}
    assert statuses[name_a] == "offline"
    assert statuses[name_b] == "online"
