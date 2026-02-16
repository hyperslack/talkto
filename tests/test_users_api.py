"""Tests for the users API endpoints."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import create_user


async def test_onboard_user(client: AsyncClient):
    """POST /api/users/onboard should create a human user."""
    resp = await client.post(
        "/api/users/onboard",
        json={"name": "yash", "display_name": "Yash", "about": "Builder of things"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "yash"
    assert data["display_name"] == "Yash"
    assert data["about"] == "Builder of things"
    assert data["type"] == "human"


async def test_onboard_user_minimal(client: AsyncClient):
    """POST /api/users/onboard with only required fields."""
    resp = await client.post("/api/users/onboard", json={"name": "alice"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "alice"
    assert data["display_name"] is None


async def test_onboard_user_reonboard_updates(client: AsyncClient, db: AsyncSession):
    """Re-onboarding should update existing user, not create duplicate."""
    await create_user(db, name="bob", user_type="human", display_name="Bob")
    await db.commit()

    resp = await client.post(
        "/api/users/onboard",
        json={"name": "bob-updated", "display_name": "Bobby"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "bob-updated"
    assert data["display_name"] == "Bobby"


async def test_get_current_user(client: AsyncClient, db: AsyncSession):
    """GET /api/users/me should return the human user."""
    await create_user(db, name="yash", user_type="human", display_name="Yash")
    await db.commit()

    resp = await client.get("/api/users/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "yash"
    assert data["display_name"] == "Yash"


async def test_get_current_user_not_onboarded(client: AsyncClient):
    """GET /api/users/me should 404 when no human is onboarded."""
    resp = await client.get("/api/users/me")
    assert resp.status_code == 404


async def test_update_profile(client: AsyncClient, db: AsyncSession):
    """PATCH /api/users/me should update the human's profile."""
    await create_user(db, name="yash", user_type="human")
    await db.commit()

    resp = await client.patch(
        "/api/users/me",
        json={"name": "yash", "display_name": "Yash K", "about": "New about"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["display_name"] == "Yash K"
    assert data["about"] == "New about"


async def test_update_profile_not_onboarded(client: AsyncClient):
    """PATCH /api/users/me should 404 when no human is onboarded."""
    resp = await client.patch("/api/users/me", json={"name": "nobody"})
    assert resp.status_code == 404


async def test_delete_profile(client: AsyncClient, db: AsyncSession):
    """DELETE /api/users/me should remove the human user."""
    await create_user(db, name="yash", user_type="human")
    await db.commit()

    resp = await client.delete("/api/users/me")
    assert resp.status_code == 204

    # Verify user is gone
    resp2 = await client.get("/api/users/me")
    assert resp2.status_code == 404


async def test_delete_profile_no_user(client: AsyncClient):
    """DELETE /api/users/me should be a no-op when no user exists."""
    resp = await client.delete("/api/users/me")
    assert resp.status_code == 204
