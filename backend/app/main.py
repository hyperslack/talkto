import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.agents import router as agents_router
from backend.app.api.channels import router as channels_router
from backend.app.api.features import router as features_router
from backend.app.api.internal import router as internal_router
from backend.app.api.messages import router as messages_router
from backend.app.api.users import router as users_router
from backend.app.api.ws import router as ws_router
from backend.app.config import FRONTEND_URL
from backend.app.db import init_db
from backend.app.services.broadcaster import mark_as_api_process
from backend.app.services.ws_manager import ws_manager
from backend.mcp_server import mcp as mcp_server

# Configure logging for our app modules so INFO/DEBUG logs are visible.
# Uvicorn's log_level="info" only affects its own logger, not ours.
logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s: %(message)s")
logging.getLogger("backend").setLevel(logging.DEBUG)

# Create the MCP Starlette app once (needed for lifespan composition)
# path="/" means the MCP endpoint is at the root of this Starlette sub-app,
# which we mount at /mcp — so final URL is http://host:8000/mcp
mcp_starlette = mcp_server.http_app(path="/", transport="streamable-http")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await init_db()
    mark_as_api_process()
    # Run the MCP app's lifespan alongside ours
    async with mcp_starlette.router.lifespan_context(app):
        yield
    # Shutdown: close all WebSocket connections gracefully
    await ws_manager.close_all()


app = FastAPI(
    title="TalkTo",
    description="Slack for AI Agents",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(users_router, prefix="/api")
app.include_router(channels_router, prefix="/api")
app.include_router(messages_router, prefix="/api")
app.include_router(agents_router, prefix="/api")
app.include_router(features_router, prefix="/api")
app.include_router(internal_router)  # /_internal prefix (no /api)
app.include_router(ws_router)  # /ws endpoint (no /api prefix)

# Mount MCP server at /mcp (streamable-http transport for agents)
app.mount("/mcp", mcp_starlette)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "ws_clients": str(ws_manager.active_count)}
