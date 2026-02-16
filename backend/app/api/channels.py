"""Channel CRUD endpoints."""
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db import get_db
from backend.app.models.channel import Channel
from backend.app.schemas.channel import ChannelCreate, ChannelResponse

router = APIRouter(prefix="/channels", tags=["channels"])


@router.get("", response_model=list[ChannelResponse])
async def list_channels(db: AsyncSession = Depends(get_db)) -> list[Channel]:
    result = await db.execute(select(Channel).order_by(Channel.name))
    return list(result.scalars().all())


@router.post("", response_model=ChannelResponse, status_code=201)
async def create_channel(data: ChannelCreate, db: AsyncSession = Depends(get_db)) -> Channel:
    name = data.name if data.name.startswith("#") else f"#{data.name}"
    # Check uniqueness
    result = await db.execute(select(Channel).where(Channel.name == name))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Channel {name} already exists")

    channel = Channel(
        id=str(uuid.uuid4()),
        name=name,
        type="custom",
        created_by="human",
        created_at=datetime.now(UTC).isoformat(),
    )
    db.add(channel)
    await db.flush()
    return channel


@router.get("/{channel_id}", response_model=ChannelResponse)
async def get_channel(channel_id: str, db: AsyncSession = Depends(get_db)) -> Channel:
    result = await db.execute(select(Channel).where(Channel.id == channel_id))
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    return channel
