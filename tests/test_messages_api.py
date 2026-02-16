"""Tests for the messages API endpoints."""

import json

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import (
    create_agent,
    create_channel,
    create_channel_member,
    create_message,
    create_user,
)


async def _setup_human_and_channel(
    db: AsyncSession,
) -> tuple:
    """Helper: create a human user and a channel, return (user, channel)."""
    user = await create_user(db, name="yash", user_type="human", display_name="Yash")
    channel = await create_channel(db, name="#general")
    await db.commit()
    return user, channel


async def test_get_messages_empty(client: AsyncClient, db: AsyncSession):
    """GET messages for a channel with no messages."""
    channel = await create_channel(db, name="#empty")
    await db.commit()

    resp = await client.get(f"/api/channels/{channel.id}/messages")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_get_messages(client: AsyncClient, db: AsyncSession):
    """GET messages should return messages in reverse-chronological order."""
    user, channel = await _setup_human_and_channel(db)
    await create_message(db, channel_id=channel.id, sender_id=user.id, content="First")
    await create_message(db, channel_id=channel.id, sender_id=user.id, content="Second")
    await db.commit()

    resp = await client.get(f"/api/channels/{channel.id}/messages")
    assert resp.status_code == 200
    messages = resp.json()
    assert len(messages) == 2
    # Most recent first
    assert messages[0]["content"] == "Second"
    assert messages[1]["content"] == "First"


async def test_get_messages_display_name(client: AsyncClient, db: AsyncSession):
    """GET messages should use display_name as sender_name when available."""
    user = await create_user(db, name="yash", user_type="human", display_name="Yash the Great")
    channel = await create_channel(db, name="#general")
    await create_message(db, channel_id=channel.id, sender_id=user.id, content="Hello")
    await db.commit()

    resp = await client.get(f"/api/channels/{channel.id}/messages")
    assert resp.status_code == 200
    messages = resp.json()
    assert messages[0]["sender_name"] == "Yash the Great"


async def test_get_messages_fallback_to_name(client: AsyncClient, db: AsyncSession):
    """GET messages should fall back to name when display_name is null."""
    user = await create_user(db, name="yash", user_type="human")  # no display_name
    channel = await create_channel(db, name="#general")
    await create_message(db, channel_id=channel.id, sender_id=user.id, content="Hello")
    await db.commit()

    resp = await client.get(f"/api/channels/{channel.id}/messages")
    messages = resp.json()
    assert messages[0]["sender_name"] == "yash"


async def test_get_messages_limit(client: AsyncClient, db: AsyncSession):
    """GET messages should respect the limit parameter."""
    user, channel = await _setup_human_and_channel(db)
    for i in range(10):
        await create_message(db, channel_id=channel.id, sender_id=user.id, content=f"Msg {i}")
    await db.commit()

    resp = await client.get(f"/api/channels/{channel.id}/messages?limit=3")
    assert resp.status_code == 200
    assert len(resp.json()) == 3


async def test_get_messages_channel_not_found(client: AsyncClient):
    """GET messages for non-existent channel should 404."""
    resp = await client.get("/api/channels/nonexistent/messages")
    assert resp.status_code == 404


async def test_send_message(client: AsyncClient, db: AsyncSession):
    """POST message should create a message and return it."""
    user, channel = await _setup_human_and_channel(db)
    await db.commit()

    resp = await client.post(
        f"/api/channels/{channel.id}/messages",
        json={"content": "Hello, world!"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["content"] == "Hello, world!"
    assert data["sender_id"] == user.id
    assert data["sender_name"] == "Yash"  # display_name


async def test_send_message_with_mentions(client: AsyncClient, db: AsyncSession):
    """POST message with mentions should store and return them."""
    user, channel = await _setup_human_and_channel(db)
    await db.commit()

    resp = await client.post(
        f"/api/channels/{channel.id}/messages",
        json={"content": "Hey @cosmic-penguin!", "mentions": ["cosmic-penguin"]},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["mentions"] == ["cosmic-penguin"]


async def test_send_message_no_user(client: AsyncClient, db: AsyncSession):
    """POST message without onboarded human should 400."""
    channel = await create_channel(db, name="#general")
    await db.commit()

    resp = await client.post(
        f"/api/channels/{channel.id}/messages",
        json={"content": "No user here"},
    )
    assert resp.status_code == 400


async def test_send_message_channel_not_found(client: AsyncClient, db: AsyncSession):
    """POST message to non-existent channel should 404."""
    await create_user(db, name="yash", user_type="human")
    await db.commit()

    resp = await client.post(
        "/api/channels/nonexistent/messages",
        json={"content": "No channel"},
    )
    assert resp.status_code == 404


async def test_get_messages_with_mentions_stored(client: AsyncClient, db: AsyncSession):
    """Messages with mentions stored as JSON should be returned as lists."""
    user, channel = await _setup_human_and_channel(db)
    await create_message(
        db,
        channel_id=channel.id,
        sender_id=user.id,
        content="Hey @turbo-flamingo",
        mentions=json.dumps(["turbo-flamingo"]),
    )
    await db.commit()

    resp = await client.get(f"/api/channels/{channel.id}/messages")
    messages = resp.json()
    assert messages[0]["mentions"] == ["turbo-flamingo"]
