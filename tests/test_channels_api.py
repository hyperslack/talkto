"""Tests for the channels API endpoints."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import create_channel


async def test_list_channels_empty(client: AsyncClient):
    """GET /api/channels should return empty list when no channels exist."""
    resp = await client.get("/api/channels")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_channels(client: AsyncClient, db: AsyncSession):
    """GET /api/channels should return all channels sorted by name."""
    await create_channel(db, name="#general")
    await create_channel(db, name="#random")
    await create_channel(db, name="#alpha")
    await db.commit()

    resp = await client.get("/api/channels")
    assert resp.status_code == 200
    names = [ch["name"] for ch in resp.json()]
    assert names == ["#alpha", "#general", "#random"]


async def test_create_channel(client: AsyncClient):
    """POST /api/channels should create a new channel."""
    resp = await client.post("/api/channels", json={"name": "dev-chat"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "#dev-chat"
    assert data["type"] == "custom"


async def test_create_channel_with_hash(client: AsyncClient):
    """POST /api/channels should accept names with # prefix."""
    resp = await client.post("/api/channels", json={"name": "#already-hashed"})
    assert resp.status_code == 201
    assert resp.json()["name"] == "#already-hashed"


async def test_create_channel_duplicate(client: AsyncClient, db: AsyncSession):
    """POST /api/channels should 409 on duplicate name."""
    await create_channel(db, name="#existing")
    await db.commit()

    resp = await client.post("/api/channels", json={"name": "existing"})
    assert resp.status_code == 409


async def test_get_channel(client: AsyncClient, db: AsyncSession):
    """GET /api/channels/{id} should return the channel."""
    channel = await create_channel(db, name="#test-get")
    await db.commit()

    resp = await client.get(f"/api/channels/{channel.id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "#test-get"


async def test_get_channel_not_found(client: AsyncClient):
    """GET /api/channels/{id} should 404 for non-existent channel."""
    resp = await client.get("/api/channels/nonexistent-id")
    assert resp.status_code == 404
