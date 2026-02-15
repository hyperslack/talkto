from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from backend.app.config import DATABASE_URL, DATA_DIR


class Base(DeclarativeBase):
    pass


engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    """FastAPI dependency for database sessions."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Create all tables and apply pragmas."""
    import backend.app.models  # noqa: F401 — ensure models are registered

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    async with engine.begin() as conn:
        # SQLite performance & safety pragmas
        await conn.execute(text("PRAGMA journal_mode = WAL"))
        await conn.execute(text("PRAGMA synchronous = NORMAL"))
        await conn.execute(text("PRAGMA foreign_keys = ON"))
        await conn.execute(text("PRAGMA busy_timeout = 5000"))
        await conn.execute(text("PRAGMA cache_size = -64000"))
        await conn.execute(text("PRAGMA temp_store = MEMORY"))

        await conn.run_sync(Base.metadata.create_all)

    # Seed default channels
    await _seed_defaults()


async def _seed_defaults() -> None:
    """Create default channels if they don't exist."""
    from backend.app.models.channel import Channel

    async with async_session() as session:
        from sqlalchemy import select

        result = await session.execute(select(Channel).where(Channel.name == "#general"))
        if result.scalar_one_or_none() is None:
            import uuid
            from datetime import datetime, timezone

            now = datetime.now(timezone.utc).isoformat()
            session.add(
                Channel(
                    id=str(uuid.uuid4()),
                    name="#general",
                    type="general",
                    created_by="system",
                    created_at=now,
                )
            )
            session.add(
                Channel(
                    id=str(uuid.uuid4()),
                    name="#random",
                    type="general",
                    created_by="system",
                    created_at=now,
                )
            )
            await session.commit()
