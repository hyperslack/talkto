"""Feature request schemas."""

from pydantic import BaseModel


class FeatureCreate(BaseModel):
    title: str
    description: str


class FeatureVoteCreate(BaseModel):
    vote: int  # +1 or -1


class FeatureResponse(BaseModel):
    id: str
    title: str
    description: str
    status: str
    created_by: str
    created_at: str
    vote_count: int = 0


class FeatureListResponse(BaseModel):
    features: list[FeatureResponse]
