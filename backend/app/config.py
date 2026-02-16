"""Application configuration with environment variable support.

All settings can be overridden via environment variables prefixed with ``TALKTO_``,
or via a ``.env`` file in the project root.

Examples::

    TALKTO_PORT=9000 uv run talkto start
    TALKTO_DB_PATH=/var/data/talkto.db uv run talkto start
    TALKTO_LOG_LEVEL=DEBUG uv run talkto start
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Project root: two levels up from this file (backend/app/config.py -> talkto/)
_BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """TalkTo configuration — all values overridable via env vars."""

    model_config = SettingsConfigDict(
        env_prefix="TALKTO_",
        env_file=str(_BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    frontend_port: int = 3000

    # Paths
    data_dir: Path = _BASE_DIR / "data"
    prompts_dir: Path = _BASE_DIR / "prompts"

    # Logging
    log_level: str = "INFO"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "talkto.db"

    @property
    def database_url(self) -> str:
        return f"sqlite+aiosqlite:///{self.db_path}"

    @property
    def frontend_url(self) -> str:
        return f"http://localhost:{self.frontend_port}"


# Singleton instance — import this everywhere
settings = Settings()

# Backward-compatible aliases (used by existing imports)
BASE_DIR = _BASE_DIR
DATA_DIR = settings.data_dir
DB_PATH = settings.db_path
DATABASE_URL = settings.database_url
PROMPTS_DIR = settings.prompts_dir

API_HOST = settings.host
API_PORT = settings.port

FRONTEND_PORT = settings.frontend_port
FRONTEND_URL = settings.frontend_url
