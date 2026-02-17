"""Direct service-layer tests.

Tests the service functions (agent_registry, message_router,
channel_manager, message_service) with the production `async_session`
monkeypatched to the test in-memory DB.
"""

import json
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.agent import Agent
from backend.app.models.channel import Channel
from backend.app.models.channel_member import ChannelMember
from backend.app.models.message import Message
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
    with patch("backend.app.services.broadcaster.broadcast_event", new_callable=AsyncMock):
        yield


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


@pytest.fixture
async def general_channel(db: AsyncSession) -> Channel:
    return await create_channel(db, name="#general", channel_type="general")


@pytest.fixture
async def human_user(db: AsyncSession) -> User:
    return await create_user(
        db, name="yash", user_type="human", display_name="Yash", about="Operator"
    )


# ---------------------------------------------------------------------------
# agent_registry.register_agent()
# ---------------------------------------------------------------------------


async def test_register_agent_creates_user_and_agent(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """register_agent should create both User and Agent records."""
    from backend.app.services.agent_registry import register_agent

    result = await register_agent(
        agent_type="claude",
        project_path="/tmp/test",
        provider_session_id="",
    )

    assert "agent_name" in result
    name = result["agent_name"]

    # Check User
    user_result = await db.execute(select(User).where(User.name == name))
    user = user_result.scalar_one_or_none()
    assert user is not None
    assert user.type == "agent"

    # Check Agent
    agent_result = await db.execute(select(Agent).where(Agent.agent_name == name))
    agent = agent_result.scalar_one_or_none()
    assert agent is not None
    assert agent.agent_type == "claude"
    assert agent.status == "online"
    assert agent.project_name == "test-project"


async def test_register_agent_creates_project_channel(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """register_agent should create a project channel if it doesn't exist."""
    from backend.app.services.agent_registry import register_agent

    result = await register_agent(
        agent_type="opencode",
        project_path="/tmp/myapp",
        provider_session_id="ses_123",
    )

    assert result["project_channel"] == "#project-test-project"

    # Verify channel was created
    ch_result = await db.execute(select(Channel).where(Channel.name == "#project-test-project"))
    assert ch_result.scalar_one_or_none() is not None


async def test_register_agent_joins_general_and_project(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """register_agent should auto-join agent to #general and project channel."""
    from backend.app.services.agent_registry import register_agent

    result = await register_agent(
        agent_type="claude",
        project_path="/tmp/test",
        provider_session_id="",
    )
    name = result["agent_name"]

    # Get agent id
    agent_result = await db.execute(select(Agent).where(Agent.agent_name == name))
    agent = agent_result.scalar_one()

    # Check membership in #general
    gen_member = await db.execute(
        select(ChannelMember).where(
            ChannelMember.user_id == agent.id,
            ChannelMember.channel_id == general_channel.id,
        )
    )
    assert gen_member.scalar_one_or_none() is not None

    # Check membership in project channel
    proj_ch = await db.execute(select(Channel).where(Channel.name == "#project-test-project"))
    project_channel = proj_ch.scalar_one()
    proj_member = await db.execute(
        select(ChannelMember).where(
            ChannelMember.user_id == agent.id,
            ChannelMember.channel_id == project_channel.id,
        )
    )
    assert proj_member.scalar_one_or_none() is not None


async def test_register_agent_renders_prompts(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """register_agent should return rendered master_prompt and inject_prompt."""
    from backend.app.services.agent_registry import register_agent

    result = await register_agent(
        agent_type="claude",
        project_path="/tmp/test",
        provider_session_id="",
    )

    assert "master_prompt" in result
    assert len(result["master_prompt"]) > 100  # Should be substantial
    assert "inject_prompt" in result
    assert result["agent_name"] in result["inject_prompt"]


# ---------------------------------------------------------------------------
# agent_registry.connect_agent()
# ---------------------------------------------------------------------------


async def test_connect_agent_updates_session(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """connect_agent should update session ID and mark agent online."""
    from backend.app.services.agent_registry import connect_agent, register_agent

    reg = await register_agent(
        agent_type="opencode",
        project_path="/tmp/test",
        provider_session_id="ses_old",
    )
    name = reg["agent_name"]

    # Mark offline first
    agent_result = await db.execute(select(Agent).where(Agent.agent_name == name))
    agent = agent_result.scalar_one()
    agent.status = "offline"
    await db.flush()

    # Reconnect
    result = await connect_agent(
        agent_name=name,
        provider_session_id="ses_new",
    )

    assert result["status"] == "connected"

    # Verify status is online
    agent_result2 = await db.execute(select(Agent).where(Agent.agent_name == name))
    agent2 = agent_result2.scalar_one()
    assert agent2.status == "online"
    assert agent2.provider_session_id == "ses_new"


async def test_connect_agent_returns_profile(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """connect_agent should return saved profile data."""
    from backend.app.services.agent_registry import (
        connect_agent,
        register_agent,
        update_agent_profile,
    )

    reg = await register_agent(
        agent_type="claude",
        project_path="/tmp/test",
        provider_session_id="",
    )
    name = reg["agent_name"]

    # Set profile
    await update_agent_profile(
        agent_name=name,
        description="Test bot",
        personality="Chill",
    )

    # Reconnect
    result = await connect_agent(agent_name=name, provider_session_id="")

    assert result["profile"] is not None
    assert result["profile"]["description"] == "Test bot"
    assert result["profile"]["personality"] == "Chill"


# ---------------------------------------------------------------------------
# agent_registry.disconnect_agent()
# ---------------------------------------------------------------------------


async def test_disconnect_agent_sets_offline(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """disconnect_agent should set status to offline."""
    from backend.app.services.agent_registry import disconnect_agent, register_agent

    reg = await register_agent(
        agent_type="claude",
        project_path="/tmp/test",
        provider_session_id="",
    )
    name = reg["agent_name"]

    result = await disconnect_agent(agent_name=name)
    assert result["status"] == "disconnected"

    agent_result = await db.execute(select(Agent).where(Agent.agent_name == name))
    assert agent_result.scalar_one().status == "offline"


async def test_disconnect_nonexistent_agent(
    mock_session,
    mock_broadcast,
    db: AsyncSession,
):
    """disconnect_agent with unknown name should return error."""
    from backend.app.services.agent_registry import disconnect_agent

    result = await disconnect_agent(agent_name="ghost-agent")
    assert "error" in result


# ---------------------------------------------------------------------------
# agent_registry.update_agent_profile()
# ---------------------------------------------------------------------------


async def test_update_profile_partial_update(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """update_agent_profile should update only provided fields."""
    from backend.app.services.agent_registry import register_agent, update_agent_profile

    reg = await register_agent(
        agent_type="claude",
        project_path="/tmp/test",
        provider_session_id="",
    )
    name = reg["agent_name"]

    # Update only description
    result = await update_agent_profile(agent_name=name, description="Just a test")
    assert result["description"] == "Just a test"
    assert result["personality"] is None  # Not set

    # Update personality without touching description
    result2 = await update_agent_profile(agent_name=name, personality="Dry")
    assert result2["personality"] == "Dry"
    assert result2["description"] == "Just a test"  # Still there


async def test_update_profile_invalid_gender(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """update_agent_profile rejects invalid gender values."""
    from backend.app.services.agent_registry import register_agent, update_agent_profile

    reg = await register_agent(
        agent_type="claude",
        project_path="/tmp/test",
        provider_session_id="",
    )

    result = await update_agent_profile(agent_name=reg["agent_name"], gender="robot")
    assert "error" in result


# ---------------------------------------------------------------------------
# message_router.send_agent_message()
# ---------------------------------------------------------------------------


async def test_send_agent_message_persists(
    mock_session,
    mock_broadcast,
    mock_invoke,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """send_agent_message should persist the message."""
    from backend.app.services.agent_registry import register_agent
    from backend.app.services.message_router import send_agent_message

    reg = await register_agent(
        agent_type="claude",
        project_path="/tmp/test",
        provider_session_id="",
    )

    result = await send_agent_message(
        agent_name=reg["agent_name"],
        channel_name="#general",
        content="Service layer test!",
    )

    assert "message_id" in result

    msg = await db.execute(select(Message).where(Message.id == result["message_id"]))
    assert msg.scalar_one().content == "Service layer test!"


async def test_send_agent_message_unknown_agent(
    mock_session,
    mock_broadcast,
    db: AsyncSession,
):
    """send_agent_message with unknown agent should return error."""
    from backend.app.services.message_router import send_agent_message

    result = await send_agent_message(
        agent_name="nonexistent",
        channel_name="#general",
        content="Hello?",
    )
    assert "error" in result


async def test_send_agent_message_unknown_channel(
    mock_session,
    mock_broadcast,
    mock_invoke,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """send_agent_message to unknown channel should return error."""
    from backend.app.services.agent_registry import register_agent
    from backend.app.services.message_router import send_agent_message

    reg = await register_agent(
        agent_type="claude",
        project_path="/tmp/test",
        provider_session_id="",
    )

    result = await send_agent_message(
        agent_name=reg["agent_name"],
        channel_name="#nonexistent",
        content="Hello?",
    )
    assert "error" in result


# ---------------------------------------------------------------------------
# message_router.get_agent_messages() — priority retrieval
# ---------------------------------------------------------------------------


async def test_get_agent_messages_specific_channel(
    mock_session,
    mock_broadcast,
    mock_invoke,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """get_agent_messages with channel specified returns channel messages."""
    from backend.app.services.agent_registry import register_agent
    from backend.app.services.message_router import get_agent_messages, send_agent_message

    reg = await register_agent(
        agent_type="claude",
        project_path="/tmp/test",
        provider_session_id="",
    )

    # Send some messages
    await send_agent_message(
        agent_name=reg["agent_name"],
        channel_name="#general",
        content="Message 1",
    )
    await send_agent_message(
        agent_name=reg["agent_name"],
        channel_name="#general",
        content="Message 2",
    )

    result = await get_agent_messages(
        agent_name=reg["agent_name"],
        channel_name="#general",
        limit=10,
    )

    assert "messages" in result
    assert len(result["messages"]) == 2


async def test_get_agent_messages_priority_mentions(
    mock_session,
    mock_broadcast,
    mock_invoke,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """get_agent_messages priority: @mentions come first."""
    from backend.app.services.agent_registry import register_agent
    from backend.app.services.message_router import get_agent_messages, send_agent_message

    reg_a = await register_agent(
        agent_type="claude",
        project_path="/tmp/test",
        provider_session_id="",
    )
    reg_b = await register_agent(
        agent_type="claude",
        project_path="/tmp/test",
        provider_session_id="",
    )
    name_a = reg_a["agent_name"]
    name_b = reg_b["agent_name"]

    # Agent A sends a regular message
    await send_agent_message(
        agent_name=name_a,
        channel_name="#general",
        content="Just a regular message",
    )

    # Agent A mentions Agent B
    await send_agent_message(
        agent_name=name_a,
        channel_name="#general",
        content=f"Hey @{name_b}!",
        mentions=[name_b],
    )

    # Agent B gets messages without channel (priority mode)
    result = await get_agent_messages(agent_name=name_b, limit=10)

    assert "messages" in result
    # The mention message should be tagged with "mention" priority
    mention_msgs = [m for m in result["messages"] if m.get("priority") == "mention"]
    assert len(mention_msgs) >= 1
    assert any(name_b in (m.get("mentions") or []) for m in mention_msgs)


async def test_get_agent_messages_respects_limit(
    mock_session,
    mock_broadcast,
    mock_invoke,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """get_agent_messages should respect the limit parameter."""
    from backend.app.services.agent_registry import register_agent
    from backend.app.services.message_router import get_agent_messages, send_agent_message

    reg = await register_agent(
        agent_type="claude",
        project_path="/tmp/test",
        provider_session_id="",
    )

    # Send 5 messages
    for i in range(5):
        await send_agent_message(
            agent_name=reg["agent_name"],
            channel_name="#general",
            content=f"Message {i}",
        )

    result = await get_agent_messages(
        agent_name=reg["agent_name"],
        channel_name="#general",
        limit=3,
    )

    assert len(result["messages"]) == 3


# ---------------------------------------------------------------------------
# channel_manager
# ---------------------------------------------------------------------------


async def test_list_all_channels(
    mock_session,
    general_channel,
    db: AsyncSession,
):
    """list_all_channels should return all channels."""
    from backend.app.services.channel_manager import list_all_channels

    channels = await list_all_channels()
    assert len(channels) >= 1
    assert any(ch["name"] == "#general" for ch in channels)


async def test_create_new_channel(
    mock_session,
    db: AsyncSession,
):
    """create_new_channel should create a channel with # prefix."""
    from backend.app.services.channel_manager import create_new_channel

    result = await create_new_channel(name="devops", created_by="test-agent")

    assert result["name"] == "#devops"
    assert result["type"] == "custom"

    ch = await db.execute(select(Channel).where(Channel.name == "#devops"))
    assert ch.scalar_one_or_none() is not None


async def test_create_new_channel_duplicate(
    mock_session,
    general_channel,
    db: AsyncSession,
):
    """create_new_channel with existing name should return error."""
    from backend.app.services.channel_manager import create_new_channel

    result = await create_new_channel(name="#general", created_by="test")
    assert "error" in result


async def test_join_agent_to_channel(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """join_agent_to_channel should add membership."""
    from backend.app.services.agent_registry import register_agent
    from backend.app.services.channel_manager import create_new_channel, join_agent_to_channel

    reg = await register_agent(
        agent_type="claude",
        project_path="/tmp/test",
        provider_session_id="",
    )

    # Create another channel
    await create_new_channel(name="extras", created_by="test")

    result = await join_agent_to_channel(
        agent_name=reg["agent_name"],
        channel_name="#extras",
    )
    assert result["status"] == "joined"

    # Double join returns already_member
    result2 = await join_agent_to_channel(
        agent_name=reg["agent_name"],
        channel_name="#extras",
    )
    assert result2["status"] == "already_member"


# ---------------------------------------------------------------------------
# message_service.create_message()
# ---------------------------------------------------------------------------


async def test_create_message_service(
    mock_broadcast,
    mock_invoke,
    general_channel,
    db: AsyncSession,
):
    """message_service.create_message should persist and return a Message."""
    from backend.app.services.message_service import create_message

    user = await create_user(db, name="test-sender", user_type="agent")
    await db.flush()

    msg = await create_message(
        db=db,
        sender_id=user.id,
        sender_name="test-sender",
        channel_id=general_channel.id,
        channel_name="#general",
        content="Service message test",
        mentions=["someone"],
    )

    assert msg.id is not None
    assert msg.content == "Service message test"
    assert json.loads(msg.mentions) == ["someone"]

    # Verify persisted
    result = await db.execute(select(Message).where(Message.id == msg.id))
    assert result.scalar_one_or_none() is not None


async def test_create_message_no_commit(
    mock_broadcast,
    mock_invoke,
    general_channel,
    db: AsyncSession,
):
    """message_service.create_message with commit=False should not commit."""
    from backend.app.services.message_service import create_message

    user = await create_user(db, name="test-sender", user_type="agent")
    await db.flush()

    msg = await create_message(
        db=db,
        sender_id=user.id,
        sender_name="test-sender",
        channel_id=general_channel.id,
        channel_name="#general",
        content="No commit test",
        commit=False,
    )

    # Message should still be in session (not committed but flushed)
    assert msg.id is not None


# ---------------------------------------------------------------------------
# agent_registry.list_all_agents()
# ---------------------------------------------------------------------------


async def test_list_all_agents(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """list_all_agents should return all agents with profile info."""
    from backend.app.services.agent_registry import (
        list_all_agents,
        register_agent,
        update_agent_profile,
    )

    reg = await register_agent(
        agent_type="claude",
        project_path="/tmp/test",
        provider_session_id="",
    )
    await update_agent_profile(
        agent_name=reg["agent_name"],
        description="Test bot",
        personality="Chill",
    )

    agents = await list_all_agents()

    assert len(agents) >= 1
    matching = [a for a in agents if a["name"] == reg["agent_name"]]
    assert len(matching) == 1
    assert matching[0]["description"] == "Test bot"
    assert matching[0]["personality"] == "Chill"


# ---------------------------------------------------------------------------
# agent_registry.agent_create_feature() + list_all_features()
# ---------------------------------------------------------------------------


async def test_create_and_list_features(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """agent_create_feature and list_all_features should work together."""
    from backend.app.services.agent_registry import (
        agent_create_feature,
        list_all_features,
        register_agent,
    )

    reg = await register_agent(
        agent_type="claude",
        project_path="/tmp/test",
        provider_session_id="",
    )

    feat = await agent_create_feature(
        agent_name=reg["agent_name"],
        title="Test Feature",
        description="A service test feature",
    )
    assert feat["status"] == "created"

    features = await list_all_features()
    assert len(features) >= 1
    assert any(f["title"] == "Test Feature" for f in features)


# ---------------------------------------------------------------------------
# agent_registry.heartbeat_agent()
# ---------------------------------------------------------------------------


async def test_heartbeat_agent(
    mock_session,
    mock_broadcast,
    mock_auto_discover,
    mock_derive_project,
    general_channel,
    human_user,
    db: AsyncSession,
):
    """heartbeat_agent returns ok for existing agent."""
    from backend.app.services.agent_registry import heartbeat_agent, register_agent

    reg = await register_agent(
        agent_type="claude",
        project_path="/tmp/test",
        provider_session_id="",
    )

    result = await heartbeat_agent(agent_name=reg["agent_name"])
    assert result["status"] == "ok"


async def test_heartbeat_nonexistent(
    mock_session,
    mock_broadcast,
    db: AsyncSession,
):
    """heartbeat_agent with unknown agent should return error."""
    from backend.app.services.agent_registry import heartbeat_agent

    result = await heartbeat_agent(agent_name="ghost")
    assert "error" in result
