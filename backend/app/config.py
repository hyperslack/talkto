from pathlib import Path

# Project root: two levels up from this file (backend/app/config.py -> talkto/)
BASE_DIR = Path(__file__).resolve().parent.parent.parent

DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "talkto.db"
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

PROMPTS_DIR = BASE_DIR / "prompts"

API_HOST = "0.0.0.0"
API_PORT = 8000

FRONTEND_PORT = 3000
FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"
