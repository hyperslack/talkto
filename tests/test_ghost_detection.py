"""Ghost detection and agent invocation pipeline tests.

Tests is_pid_alive, _is_session_alive, is_agent_ghost, _compute_ghost,
format_invocation_prompt, and spawn_background_task.
"""

import asyncio
import os
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.session import Session
from backend.app.services.agent_invoker import (
    _is_session_alive,
    format_invocation_prompt,
    is_agent_ghost,
    is_pid_alive,
    spawn_background_task,
)
from tests.conftest import create_agent

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


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

    with patch("backend.app.services.agent_invoker.async_session", _fake_factory):
        yield db


# ---------------------------------------------------------------------------
# format_invocation_prompt()
# ---------------------------------------------------------------------------


def test_format_invocation_prompt_mention():
    """format_invocation_prompt for a channel @mention."""
    prompt = format_invocation_prompt(
        sender_name="turbo-flamingo",
        channel_name="#general",
        content="Can you help me?",
    )

    assert "turbo-flamingo mentioned you in #general" in prompt
    assert "send_message" in prompt
    assert '"#general"' in prompt
    assert "Can you help me?" in prompt


def test_format_invocation_prompt_dm():
    """format_invocation_prompt for a DM channel."""
    prompt = format_invocation_prompt(
        sender_name="cosmic-penguin",
        channel_name="#dm-turbo-flamingo",
        content="Hey, quick question",
    )

    assert "Direct message from cosmic-penguin" in prompt
    assert '"#dm-turbo-flamingo"' in prompt
    assert "Hey, quick question" in prompt


def test_format_invocation_prompt_with_context():
    """format_invocation_prompt includes recent context when provided."""
    context = "  alice: Hello everyone\n  bob: Hey alice"
    prompt = format_invocation_prompt(
        sender_name="alice",
        channel_name="#general",
        content="@bob what do you think?",
        recent_context=context,
    )

    assert "Recent messages:" in prompt
    assert "alice: Hello everyone" in prompt
    assert "bob: Hey alice" in prompt


def test_format_invocation_prompt_no_context():
    """format_invocation_prompt without context should not include context section."""
    prompt = format_invocation_prompt(
        sender_name="alice",
        channel_name="#general",
        content="Hello",
        recent_context=None,
    )

    assert "Recent messages:" not in prompt


# ---------------------------------------------------------------------------
# is_pid_alive()
# ---------------------------------------------------------------------------


def test_is_pid_alive_self():
    """Current process PID should be alive."""
    assert is_pid_alive(os.getpid()) is True


def test_is_pid_alive_dead_pid():
    """A non-existent PID should not be alive."""
    # Use a PID that fits in a signed int but is very unlikely to exist
    # We mock os.kill to raise ProcessLookupError for determinism
    with patch("backend.app.services.agent_invoker.os.kill", side_effect=ProcessLookupError):
        assert is_pid_alive(99999) is False


def test_is_pid_alive_os_error():
    """is_pid_alive returns False on OSError (permission denied, etc.)."""
    with patch("backend.app.services.agent_invoker.os.kill", side_effect=OSError):
        assert is_pid_alive(1) is False


# ---------------------------------------------------------------------------
# _is_session_alive()
# ---------------------------------------------------------------------------


async def test_is_session_alive_found():
    """_is_session_alive returns True when ps aux shows matching process."""
    fake_ps_output = (
        "user  12345  0.0  0.5 ... opencode -s ses_abc123\nuser  12346  0.0  0.1 ... vim file.py\n"
    )

    async def _fake_subprocess(*args, **kwargs):
        proc = MagicMock()
        proc.communicate = AsyncMock(return_value=(fake_ps_output.encode(), b""))
        proc.returncode = 0
        return proc

    with patch(
        "backend.app.services.agent_invoker.asyncio.create_subprocess_exec", _fake_subprocess
    ):
        result = await _is_session_alive("ses_abc123")

    assert result is True


async def test_is_session_alive_not_found():
    """_is_session_alive returns False when no matching process."""
    fake_ps_output = (
        "user  12345  0.0  0.5 ... python server.py\nuser  12346  0.0  0.1 ... vim file.py\n"
    )

    async def _fake_subprocess(*args, **kwargs):
        proc = MagicMock()
        proc.communicate = AsyncMock(return_value=(fake_ps_output.encode(), b""))
        proc.returncode = 0
        return proc

    with patch(
        "backend.app.services.agent_invoker.asyncio.create_subprocess_exec", _fake_subprocess
    ):
        result = await _is_session_alive("ses_xyz789")

    assert result is False


async def test_is_session_alive_excludes_serve():
    """_is_session_alive should exclude 'opencode serve' processes."""
    fake_ps_output = "user  12345  0.0  0.5 ... opencode serve -s ses_abc123\n"

    async def _fake_subprocess(*args, **kwargs):
        proc = MagicMock()
        proc.communicate = AsyncMock(return_value=(fake_ps_output.encode(), b""))
        proc.returncode = 0
        return proc

    with patch(
        "backend.app.services.agent_invoker.asyncio.create_subprocess_exec", _fake_subprocess
    ):
        result = await _is_session_alive("ses_abc123")

    assert result is False


async def test_is_session_alive_ps_fails():
    """_is_session_alive should return True (assume alive) if ps fails."""
    with patch(
        "backend.app.services.agent_invoker.asyncio.create_subprocess_exec",
        side_effect=FileNotFoundError("ps not found"),
    ):
        result = await _is_session_alive("ses_abc123")

    assert result is True  # Conservative: assume alive


# ---------------------------------------------------------------------------
# is_agent_ghost()
# ---------------------------------------------------------------------------


async def test_is_agent_ghost_system_agent(
    mock_session,
    db: AsyncSession,
):
    """System agents are never ghosts."""
    user, agent = await create_agent(
        db,
        agent_name="the-creator",
        agent_type="system",
        status="online",
    )
    await db.flush()

    result = await is_agent_ghost("the-creator")
    assert result is False


async def test_is_agent_ghost_nonexistent(
    mock_session,
    db: AsyncSession,
):
    """Non-existent agent is not a ghost (returns False)."""
    result = await is_agent_ghost("does-not-exist")
    assert result is False


async def test_is_agent_ghost_with_live_session(
    mock_session,
    db: AsyncSession,
):
    """Agent with live credentials and alive session is not a ghost."""
    user, agent = await create_agent(
        db,
        agent_name="live-agent",
        agent_type="opencode",
        server_url="http://localhost:1234",
        provider_session_id="ses_live123",
    )
    await db.flush()

    with patch(
        "backend.app.services.agent_invoker._is_session_alive",
        new_callable=AsyncMock,
        return_value=True,
    ):
        result = await is_agent_ghost("live-agent")

    assert result is False


async def test_is_agent_ghost_no_credentials_no_session(
    mock_session,
    db: AsyncSession,
):
    """Agent with no credentials and no active session is a ghost."""
    user, agent = await create_agent(
        db,
        agent_name="ghost-agent",
        agent_type="claude",
        server_url=None,
        provider_session_id=None,
    )
    await db.flush()

    # Mock auto-discovery to fail
    with patch(
        "backend.app.services.agent_invoker._is_session_alive",
        new_callable=AsyncMock,
        return_value=False,
    ):
        result = await is_agent_ghost("ghost-agent")

    assert result is True


async def test_is_agent_ghost_stale_session(
    mock_session,
    db: AsyncSession,
):
    """Agent with credentials but dead session is a ghost."""
    user, agent = await create_agent(
        db,
        agent_name="stale-agent",
        agent_type="opencode",
        server_url="http://localhost:1234",
        provider_session_id="ses_dead",
    )
    await db.flush()

    with patch(
        "backend.app.services.agent_invoker._is_session_alive",
        new_callable=AsyncMock,
        return_value=False,
    ):
        result = await is_agent_ghost("stale-agent")

    # No active TalkTo session either → ghost
    assert result is True


# ---------------------------------------------------------------------------
# _compute_ghost() (from agents.py)
# ---------------------------------------------------------------------------


async def test_compute_ghost_system_agent(db: AsyncSession):
    """_compute_ghost: system agents are never ghosts."""
    from backend.app.api.agents import _compute_ghost

    user, agent = await create_agent(
        db,
        agent_name="system-bot",
        agent_type="system",
    )
    await db.flush()

    result = await _compute_ghost(agent, db, "")
    assert result is False


async def test_compute_ghost_with_live_session_in_ps(db: AsyncSession):
    """_compute_ghost: agent with session visible in ps output is not a ghost."""
    from backend.app.api.agents import _compute_ghost

    user, agent = await create_agent(
        db,
        agent_name="live-bot",
        agent_type="opencode",
        server_url="http://localhost:1234",
        provider_session_id="ses_live456",
    )
    await db.flush()

    ps_output = "user 12345 0.0 0.5 ... opencode -s ses_live456\n"
    result = await _compute_ghost(agent, db, ps_output)
    assert result is False


async def test_compute_ghost_session_not_in_ps(db: AsyncSession):
    """_compute_ghost: agent with session NOT in ps output is a ghost."""
    from backend.app.api.agents import _compute_ghost

    user, agent = await create_agent(
        db,
        agent_name="dead-bot",
        agent_type="opencode",
        server_url="http://localhost:1234",
        provider_session_id="ses_dead789",
    )
    await db.flush()

    ps_output = "user 12345 0.0 0.5 ... vim file.py\n"
    result = await _compute_ghost(agent, db, ps_output)
    assert result is True


async def test_compute_ghost_no_credentials_no_talkto_session(db: AsyncSession):
    """_compute_ghost: no credentials + no active TalkTo session = ghost."""
    from backend.app.api.agents import _compute_ghost

    user, agent = await create_agent(
        db,
        agent_name="orphan-bot",
        agent_type="claude",
        server_url=None,
        provider_session_id=None,
    )
    await db.flush()

    result = await _compute_ghost(agent, db, "")
    assert result is True


async def test_compute_ghost_no_credentials_with_alive_pid(db: AsyncSession):
    """_compute_ghost: no credentials but PID is alive = not a ghost."""
    from backend.app.api.agents import _compute_ghost

    user, agent = await create_agent(
        db,
        agent_name="pid-bot",
        agent_type="codex",
        server_url=None,
        provider_session_id=None,
    )
    await db.flush()

    # Create an active TalkTo session with the current PID (known alive)
    now = datetime.now(UTC).isoformat()
    session = Session(
        id=str(__import__("uuid").uuid4()),
        agent_id=agent.id,
        pid=os.getpid(),  # Current process — guaranteed alive
        tty="ttys000",
        started_at=now,
        last_heartbeat=now,
        is_active=1,
    )
    db.add(session)
    await db.flush()

    result = await _compute_ghost(agent, db, "")
    assert result is False


# ---------------------------------------------------------------------------
# _is_session_in_ps() helper (from agents.py)
# ---------------------------------------------------------------------------


def test_is_session_in_ps_found():
    """_is_session_in_ps finds session in ps output."""
    from backend.app.api.agents import _is_session_in_ps

    ps = "user 12345 0.0 0.5 ... opencode -s ses_abc\nuser 12346 ... vim\n"
    assert _is_session_in_ps("ses_abc", ps) is True


def test_is_session_in_ps_not_found():
    """_is_session_in_ps returns False when no match."""
    from backend.app.api.agents import _is_session_in_ps

    ps = "user 12345 0.0 0.5 ... python server.py\n"
    assert _is_session_in_ps("ses_xyz", ps) is False


def test_is_session_in_ps_excludes_serve():
    """_is_session_in_ps excludes 'opencode serve' lines."""
    from backend.app.api.agents import _is_session_in_ps

    ps = "user 12345 0.0 0.5 ... opencode serve ses_abc\n"
    assert _is_session_in_ps("ses_abc", ps) is False


# ---------------------------------------------------------------------------
# spawn_background_task()
# ---------------------------------------------------------------------------


async def test_spawn_background_task_tracks():
    """spawn_background_task should track tasks and auto-cleanup."""
    from backend.app.services.agent_invoker import _background_tasks

    len(_background_tasks)

    async def _noop():
        pass

    task = spawn_background_task(_noop())
    assert task in _background_tasks

    # Wait for it to finish
    await task

    # Give the event loop a tick for the done callback
    await asyncio.sleep(0)

    # Task should be removed from tracking set
    assert task not in _background_tasks


async def test_spawn_background_task_multiple():
    """Multiple background tasks should all be tracked."""
    from backend.app.services.agent_invoker import _background_tasks

    results = []

    async def _append(val):
        results.append(val)

    t1 = spawn_background_task(_append(1))
    t2 = spawn_background_task(_append(2))
    t3 = spawn_background_task(_append(3))

    assert t1 in _background_tasks
    assert t2 in _background_tasks
    assert t3 in _background_tasks

    await asyncio.gather(t1, t2, t3)
    await asyncio.sleep(0)

    assert set(results) == {1, 2, 3}
