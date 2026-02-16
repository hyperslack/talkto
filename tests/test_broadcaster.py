"""Tests for event factory helpers in the broadcaster module."""

from backend.app.services.broadcaster import (
    agent_status_event,
    agent_typing_event,
    channel_created_event,
    feature_update_event,
    new_message_event,
)


def test_new_message_event_structure():
    """new_message event should have correct type and all fields."""
    event = new_message_event(
        message_id="msg-1",
        channel_id="chan-1",
        sender_id="user-1",
        sender_name="cosmic-penguin",
        content="Hello!",
        mentions=["turbo-flamingo"],
        parent_id=None,
        created_at="2025-01-01T00:00:00",
    )
    assert event["type"] == "new_message"
    data = event["data"]
    assert data["id"] == "msg-1"
    assert data["channel_id"] == "chan-1"
    assert data["sender_id"] == "user-1"
    assert data["sender_name"] == "cosmic-penguin"
    assert data["content"] == "Hello!"
    assert data["mentions"] == ["turbo-flamingo"]
    assert data["parent_id"] is None
    assert data["created_at"] == "2025-01-01T00:00:00"


def test_new_message_event_defaults():
    """Defaults should be empty list for mentions and empty string for created_at."""
    event = new_message_event(
        message_id="msg-1",
        channel_id="chan-1",
        sender_id="user-1",
        sender_name="test",
        content="Hi",
    )
    assert event["data"]["mentions"] == []
    assert event["data"]["parent_id"] is None
    assert event["data"]["created_at"] == ""


def test_agent_status_event():
    """agent_status event should have correct structure."""
    event = agent_status_event(
        agent_name="cosmic-penguin",
        status="online",
        agent_type="opencode",
        project_name="talkto",
    )
    assert event["type"] == "agent_status"
    assert event["data"]["agent_name"] == "cosmic-penguin"
    assert event["data"]["status"] == "online"
    assert event["data"]["agent_type"] == "opencode"
    assert event["data"]["project_name"] == "talkto"


def test_channel_created_event():
    """channel_created event should have correct structure."""
    event = channel_created_event(
        channel_id="chan-1",
        channel_name="#new-channel",
        channel_type="custom",
        project_path="/tmp/test",
    )
    assert event["type"] == "channel_created"
    assert event["data"]["id"] == "chan-1"
    assert event["data"]["name"] == "#new-channel"
    assert event["data"]["type"] == "custom"
    assert event["data"]["project_path"] == "/tmp/test"


def test_agent_typing_event_typing():
    """agent_typing event when typing."""
    event = agent_typing_event("cosmic-penguin", "chan-1", True)
    assert event["type"] == "agent_typing"
    assert event["data"]["agent_name"] == "cosmic-penguin"
    assert event["data"]["is_typing"] is True
    assert "error" not in event["data"]


def test_agent_typing_event_with_error():
    """agent_typing event with error should include error field."""
    event = agent_typing_event("cosmic-penguin", "chan-1", False, error="Agent unreachable")
    assert event["data"]["is_typing"] is False
    assert event["data"]["error"] == "Agent unreachable"


def test_feature_update_event():
    """feature_update event should have correct structure."""
    event = feature_update_event(
        feature_id="feat-1",
        title="Cool Feature",
        status="open",
        vote_count=5,
        update_type="voted",
    )
    assert event["type"] == "feature_update"
    data = event["data"]
    assert data["id"] == "feat-1"
    assert data["title"] == "Cool Feature"
    assert data["status"] == "open"
    assert data["vote_count"] == 5
    assert data["update_type"] == "voted"
