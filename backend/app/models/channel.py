from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db import Base


class Channel(Base):
    __tablename__ = "channels"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    type: Mapped[str] = mapped_column(String, nullable=False)  # "project", "general", "custom"
    project_path: Mapped[str | None] = mapped_column(String, nullable=True)
    created_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)

    # Relationships
    members: Mapped[list[ChannelMember]] = relationship("ChannelMember", back_populates="channel")
    messages: Mapped[list[Message]] = relationship("Message", back_populates="channel")
