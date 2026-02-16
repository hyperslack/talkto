"""Tests for the agents API endpoints."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import create_agent, create_channel, create_user


async def test_list_agents_empty(client: AsyncClient):
    """GET /api/agents should return empty list when no agents exist."""
    resp = await client.get("/api/agents")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_agents(client: AsyncClient, db: AsyncSession):
    """GET /api/agents should return all agents."""
    await create_agent(db, agent_name="cosmic-penguin", project_name="proj-a")
    await create_agent(db, agent_name="turbo-flamingo", project_name="proj-b")
    await db.commit()

    resp = await client.get("/api/agents")
    assert resp.status_code == 200
    agents = resp.json()
    assert len(agents) == 2
    names = {a["agent_name"] for a in agents}
    assert names == {"cosmic-penguin", "turbo-flamingo"}


async def test_list_agents_sorted(client: AsyncClient, db: AsyncSession):
    """GET /api/agents should return agents sorted by name."""
    await create_agent(db, agent_name="zesty-zebra")
    await create_agent(db, agent_name="alpha-alpaca")
    await db.commit()

    resp = await client.get("/api/agents")
    names = [a["agent_name"] for a in resp.json()]
    assert names == ["alpha-alpaca", "zesty-zebra"]


async def test_get_agent(client: AsyncClient, db: AsyncSession):
    """GET /api/agents/{name} should return a single agent."""
    await create_agent(
        db,
        agent_name="cosmic-penguin",
        description="Backend wizard",
        personality="Dry wit",
    )
    await db.commit()

    resp = await client.get("/api/agents/cosmic-penguin")
    assert resp.status_code == 200
    data = resp.json()
    assert data["agent_name"] == "cosmic-penguin"
    assert data["description"] == "Backend wizard"
    assert data["personality"] == "Dry wit"


async def test_get_agent_not_found(client: AsyncClient):
    """GET /api/agents/{name} should 404 for non-existent agent."""
    resp = await client.get("/api/agents/nonexistent")
    assert resp.status_code == 404


async def test_get_agent_system_not_ghost(client: AsyncClient, db: AsyncSession):
    """System agents should never be marked as ghosts."""
    await create_agent(db, agent_name="the_creator", agent_type="system")
    await db.commit()

    resp = await client.get("/api/agents/the_creator")
    data = resp.json()
    assert data["is_ghost"] is False


async def test_get_or_create_dm(client: AsyncClient, db: AsyncSession):
    """POST /api/agents/{name}/dm should create a DM channel."""
    await create_agent(db, agent_name="cosmic-penguin")
    await db.commit()

    resp = await client.post("/api/agents/cosmic-penguin/dm")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "#dm-cosmic-penguin"
    assert data["type"] == "dm"


async def test_get_or_create_dm_idempotent(client: AsyncClient, db: AsyncSession):
    """POST /api/agents/{name}/dm should return existing DM if it exists."""
    await create_agent(db, agent_name="cosmic-penguin")
    await db.commit()

    resp1 = await client.post("/api/agents/cosmic-penguin/dm")
    resp2 = await client.post("/api/agents/cosmic-penguin/dm")
    assert resp1.json()["id"] == resp2.json()["id"]


async def test_get_or_create_dm_agent_not_found(client: AsyncClient):
    """POST /api/agents/{name}/dm should 404 for non-existent agent."""
    resp = await client.post("/api/agents/nonexistent/dm")
    assert resp.status_code == 404
