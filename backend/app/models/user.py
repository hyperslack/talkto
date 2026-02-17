from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)  # "human" or "agent"
    # Timestamps are stored as ISO 8601 strings (not datetime columns) throughout
    # the schema. This avoids timezone/serialization issues with SQLite and keeps
    # JSON output consistent. Changing to datetime would require a migration.
    created_at: Mapped[str] = mapped_column(String, nullable=False)

    # Human-only profile fields (nullable for agent users)
    display_name: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    about: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    agent_instructions: Mapped[str | None] = mapped_column(String, nullable=True, default=None)

    # Relationships
    agent: Mapped[Agent | None] = relationship("Agent", back_populates="user", uselist=False)
    messages: Mapped[list[Message]] = relationship("Message", back_populates="sender")
