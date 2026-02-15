from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db import Base


class FeatureRequest(Base):
    __tablename__ = "feature_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="open")
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


class FeatureVote(Base):
    __tablename__ = "feature_votes"

    feature_id: Mapped[str] = mapped_column(
        String, ForeignKey("feature_requests.id"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), primary_key=True)
    vote: Mapped[int] = mapped_column(Integer, nullable=False)  # +1 or -1
