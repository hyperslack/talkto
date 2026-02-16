"""Feature request endpoints."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db import get_db
from backend.app.models.feature import FeatureRequest, FeatureVote
from backend.app.models.user import User
from backend.app.schemas.feature import FeatureCreate, FeatureResponse, FeatureVoteCreate
from backend.app.services.broadcaster import broadcast_event, feature_update_event

router = APIRouter(prefix="/features", tags=["features"])


@router.get("", response_model=list[FeatureResponse])
async def list_features(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    query = (
        select(
            FeatureRequest,
            func.coalesce(func.sum(FeatureVote.vote), 0).label("vote_count"),
        )
        .outerjoin(FeatureVote, FeatureRequest.id == FeatureVote.feature_id)
        .group_by(FeatureRequest.id)
    )

    if status:
        query = query.where(FeatureRequest.status == status)

    query = query.order_by(desc(FeatureRequest.created_at))
    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": fr.id,
            "title": fr.title,
            "description": fr.description,
            "status": fr.status,
            "created_by": fr.created_by,
            "created_at": fr.created_at,
            "vote_count": vote_count,
        }
        for fr, vote_count in rows
    ]


@router.post("", response_model=FeatureResponse, status_code=201)
async def create_feature(data: FeatureCreate, db: AsyncSession = Depends(get_db)) -> dict:
    user_result = await db.execute(select(User).where(User.type == "human"))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="No user onboarded")

    feature = FeatureRequest(
        id=str(uuid.uuid4()),
        title=data.title,
        description=data.description,
        status="open",
        created_by=user.id,
        created_at=datetime.now(UTC).isoformat(),
    )
    db.add(feature)
    await db.flush()

    # Broadcast new feature creation
    await broadcast_event(
        feature_update_event(
            feature_id=feature.id,
            title=feature.title,
            status=feature.status,
            vote_count=0,
            update_type="created",
        )
    )

    return {
        "id": feature.id,
        "title": feature.title,
        "description": feature.description,
        "status": feature.status,
        "created_by": feature.created_by,
        "created_at": feature.created_at,
        "vote_count": 0,
    }


@router.post("/{feature_id}/vote", status_code=200)
async def vote_feature(
    feature_id: str,
    data: FeatureVoteCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    # Verify feature exists
    fr = await db.execute(select(FeatureRequest).where(FeatureRequest.id == feature_id))
    if not fr.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Feature not found")

    user_result = await db.execute(select(User).where(User.type == "human"))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="No user onboarded")

    if data.vote not in (1, -1):
        raise HTTPException(status_code=400, detail="Vote must be +1 or -1")

    # Upsert vote
    existing = await db.execute(
        select(FeatureVote).where(
            FeatureVote.feature_id == feature_id,
            FeatureVote.user_id == user.id,
        )
    )
    vote = existing.scalar_one_or_none()
    if vote:
        vote.vote = data.vote
    else:
        db.add(FeatureVote(feature_id=feature_id, user_id=user.id, vote=data.vote))
    await db.flush()

    # Get feature title and updated vote count for broadcast
    feature_result = await db.execute(select(FeatureRequest).where(FeatureRequest.id == feature_id))
    feature = feature_result.scalar_one()
    count_result = await db.execute(
        select(func.coalesce(func.sum(FeatureVote.vote), 0)).where(
            FeatureVote.feature_id == feature_id
        )
    )
    vote_count = count_result.scalar()

    await broadcast_event(
        feature_update_event(
            feature_id=feature_id,
            title=feature.title,
            status=feature.status,
            vote_count=vote_count,
            update_type="voted",
        )
    )

    return {"status": "voted", "vote": data.vote}
