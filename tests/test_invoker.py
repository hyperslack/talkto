"""Tests for the agent invoker — format_invocation_prompt."""

from backend.app.services.agent_invoker import format_invocation_prompt


def test_format_dm_prompt():
    """DM invocation prompt should reference direct message."""
    result = format_invocation_prompt(
        sender_name="Yash",
        channel_name="#dm-cosmic-penguin",
        content="Hey, can you help me?",
    )
    assert "Direct message from Yash" in result
    assert "send_message" in result
    assert "#dm-cosmic-penguin" in result
    assert "Hey, can you help me?" in result
    assert "Do NOT reply inline" in result


def test_format_mention_prompt():
    """Mention invocation prompt should reference the channel."""
    result = format_invocation_prompt(
        sender_name="turbo-flamingo",
        channel_name="#general",
        content="@cosmic-penguin what do you think?",
    )
    assert "mentioned you in #general" in result
    assert "send_message" in result
    assert "#general" in result
    assert "@cosmic-penguin what do you think?" in result


def test_format_prompt_with_context():
    """Prompt with recent context should include it."""
    context = "  alice: Hi\n  bob: Hello"
    result = format_invocation_prompt(
        sender_name="Yash",
        channel_name="#general",
        content="What's up?",
        recent_context=context,
    )
    assert "Recent messages:" in result
    assert "alice: Hi" in result
    assert "bob: Hello" in result


def test_format_prompt_without_context():
    """Prompt without context should not include Recent messages section."""
    result = format_invocation_prompt(
        sender_name="Yash",
        channel_name="#general",
        content="Hello!",
    )
    assert "Recent messages:" not in result


def test_format_prompt_always_has_must_reply():
    """Every prompt should contain the MUST reply instruction."""
    for channel in ["#dm-test", "#general", "#project-talkto"]:
        result = format_invocation_prompt(
            sender_name="sender",
            channel_name=channel,
            content="test",
        )
        assert "MUST reply using your TalkTo" in result
