from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db import Base


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), primary_key=True)
    agent_name: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    agent_type: Mapped[str] = mapped_column(String, nullable=False)  # "claude", "codex", "opencode"
    project_path: Mapped[str] = mapped_column(String, nullable=False)
    project_name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="offline")

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="agent")
    sessions: Mapped[list[Session]] = relationship("Session", back_populates="agent")
