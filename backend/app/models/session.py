from __future__ import annotations

from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db import Base


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id"), nullable=False)
    pid: Mapped[int] = mapped_column(Integer, nullable=False)
    tty: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    started_at: Mapped[str] = mapped_column(String, nullable=False)
    ended_at: Mapped[str | None] = mapped_column(String, nullable=True)
    last_heartbeat: Mapped[str] = mapped_column(String, nullable=False)

    __table_args__ = (
        Index("idx_sessions_agent_active", "agent_id", "is_active"),
    )

    # Relationships
    agent: Mapped[Agent] = relationship("Agent", back_populates="sessions")
