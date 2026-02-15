from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db import Base


class ChannelMember(Base):
    __tablename__ = "channel_members"

    channel_id: Mapped[str] = mapped_column(String, ForeignKey("channels.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), primary_key=True)
    joined_at: Mapped[str] = mapped_column(String, nullable=False)

    # Relationships
    channel: Mapped[Channel] = relationship("Channel", back_populates="members")
    user: Mapped[User] = relationship("User")
