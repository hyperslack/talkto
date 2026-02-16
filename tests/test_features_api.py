"""Tests for the features API endpoints."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import create_feature, create_user, create_vote


async def test_list_features_empty(client: AsyncClient):
    """GET /api/features should return empty list when no features exist."""
    resp = await client.get("/api/features")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_features(client: AsyncClient, db: AsyncSession):
    """GET /api/features should return features with vote counts."""
    user = await create_user(db, name="yash", user_type="human")
    feat = await create_feature(
        db, title="Threading", description="Message threads", created_by=user.id
    )
    await create_vote(db, feature_id=feat.id, user_id=user.id, vote=1)
    await db.commit()

    resp = await client.get("/api/features")
    assert resp.status_code == 200
    features = resp.json()
    assert len(features) == 1
    assert features[0]["title"] == "Threading"
    assert features[0]["vote_count"] == 1


async def test_list_features_filter_by_status(client: AsyncClient, db: AsyncSession):
    """GET /api/features?status=open should filter by status."""
    user = await create_user(db, name="yash", user_type="human")
    await create_feature(db, title="Open One", status="open", created_by=user.id)
    await create_feature(db, title="Closed One", status="closed", created_by=user.id)
    await db.commit()

    resp = await client.get("/api/features?status=open")
    features = resp.json()
    assert len(features) == 1
    assert features[0]["title"] == "Open One"


async def test_create_feature(client: AsyncClient, db: AsyncSession):
    """POST /api/features should create a feature request."""
    await create_user(db, name="yash", user_type="human")
    await db.commit()

    resp = await client.post(
        "/api/features",
        json={"title": "Dark Mode", "description": "Support dark theme"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Dark Mode"
    assert data["status"] == "open"
    assert data["vote_count"] == 0


async def test_create_feature_no_user(client: AsyncClient):
    """POST /api/features without human user should 400."""
    resp = await client.post(
        "/api/features",
        json={"title": "Test", "description": "Test"},
    )
    assert resp.status_code == 400


async def test_vote_feature(client: AsyncClient, db: AsyncSession):
    """POST /api/features/{id}/vote should record a vote."""
    user = await create_user(db, name="yash", user_type="human")
    feat = await create_feature(db, title="Threading", description="Threads", created_by=user.id)
    await db.commit()

    resp = await client.post(f"/api/features/{feat.id}/vote", json={"vote": 1})
    assert resp.status_code == 200
    assert resp.json()["status"] == "voted"


async def test_vote_feature_invalid_vote(client: AsyncClient, db: AsyncSession):
    """POST /api/features/{id}/vote should reject invalid vote values."""
    user = await create_user(db, name="yash", user_type="human")
    feat = await create_feature(db, title="Test", description="Test", created_by=user.id)
    await db.commit()

    resp = await client.post(f"/api/features/{feat.id}/vote", json={"vote": 5})
    assert resp.status_code == 400


async def test_vote_feature_not_found(client: AsyncClient, db: AsyncSession):
    """POST /api/features/{id}/vote should 404 for non-existent feature."""
    await create_user(db, name="yash", user_type="human")
    await db.commit()

    resp = await client.post("/api/features/nonexistent/vote", json={"vote": 1})
    assert resp.status_code == 404


async def test_vote_feature_upsert(client: AsyncClient, db: AsyncSession):
    """Voting again should update the existing vote, not duplicate."""
    user = await create_user(db, name="yash", user_type="human")
    feat = await create_feature(db, title="Test", description="Test", created_by=user.id)
    await db.commit()

    # Vote +1
    await client.post(f"/api/features/{feat.id}/vote", json={"vote": 1})
    # Change to -1
    resp = await client.post(f"/api/features/{feat.id}/vote", json={"vote": -1})
    assert resp.status_code == 200

    # Check vote count is -1 (single vote changed from +1 to -1)
    features_resp = await client.get("/api/features")
    features = features_resp.json()
    assert features[0]["vote_count"] == -1
