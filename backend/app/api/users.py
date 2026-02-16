"""User onboarding & profile endpoints."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db import get_db
from backend.app.models.user import User
from backend.app.schemas.user import UserOnboard, UserResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/onboard", response_model=UserResponse, status_code=201)
async def onboard_user(data: UserOnboard, db: AsyncSession = Depends(get_db)) -> User:
    # Check if human already exists
    result = await db.execute(select(User).where(User.type == "human"))
    existing = result.scalar_one_or_none()
    if existing:
        # Update all fields on re-onboard
        existing.name = data.name
        existing.display_name = data.display_name
        existing.about = data.about
        existing.agent_instructions = data.agent_instructions
        return existing

    user = User(
        id=str(uuid.uuid4()),
        name=data.name,
        type="human",
        created_at=datetime.now(UTC).isoformat(),
        display_name=data.display_name,
        about=data.about,
        agent_instructions=data.agent_instructions,
    )
    db.add(user)
    await db.flush()
    return user


@router.get("/me", response_model=UserResponse)
async def get_current_user(db: AsyncSession = Depends(get_db)) -> User:
    result = await db.execute(select(User).where(User.type == "human"))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="No human user onboarded yet")
    return user


@router.patch("/me", response_model=UserResponse)
async def update_profile(data: UserOnboard, db: AsyncSession = Depends(get_db)) -> User:
    result = await db.execute(select(User).where(User.type == "human"))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="No human user onboarded yet")

    user.name = data.name
    user.display_name = data.display_name
    user.about = data.about
    user.agent_instructions = data.agent_instructions
    return user


@router.delete("/me", status_code=204)
async def delete_profile(db: AsyncSession = Depends(get_db)) -> None:
    """Delete the current human user so a new one can onboard."""
    result = await db.execute(select(User).where(User.type == "human"))
    user = result.scalar_one_or_none()
    if user:
        await db.delete(user)
        await db.flush()
