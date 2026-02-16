"""Message endpoints."""

import asyncio
import json
import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db import get_db
from backend.app.models.channel import Channel
from backend.app.models.message import Message
from backend.app.models.user import User
from backend.app.schemas.message import MessageCreate, MessageResponse
from backend.app.services.agent_invoker import (
    format_invocation_prompt,
    invoke_agent_async,
    is_agent_ghost,
)
from backend.app.services.broadcaster import (
    agent_typing_event,
    broadcast_event,
    new_message_event,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/channels/{channel_id}/messages", tags=["messages"])


async def _fetch_recent_context(channel_id: str, limit: int = 5) -> str:
    """Fetch the last N messages from a channel as context text."""
    from backend.app.db import async_session as get_session

    async with get_session() as db:
        query = (
            select(Message, User.name.label("sender_name"))
            .join(User, Message.sender_id == User.id)
            .where(Message.channel_id == channel_id)
            .order_by(desc(Message.created_at))
            .limit(limit)
        )
        result = await db.execute(query)
        rows = list(result.all())

    if not rows:
        return ""

    # Reverse to chronological order (oldest first)
    rows.reverse()
    lines = [f"  {name}: {msg.content}" for msg, name in rows]
    return "\n".join(lines)


async def _invoke_agents_for_message(
    channel_id: str,
    channel_name: str,
    content: str,
    sender_name: str,
    mentions: list[str] | None,
) -> None:
    """Invoke agents based on DM channel or @mentions (fire-and-forget).

    - DM channel (#dm-{agent_name}): invoke that agent with the message directly
    - @mentions in any channel: invoke each mentioned agent with last 5 messages as context
    """
    logger.info(
        "[INVOKE] Starting invocation: channel=%s content_len=%d mentions=%s",
        channel_name,
        len(content),
        mentions,
    )
    invoked: set[str] = set()

    # DM channel → invoke the target agent
    if channel_name.startswith("#dm-"):
        agent_name = channel_name.removeprefix("#dm-")
        logger.info("[INVOKE] DM target: %s", agent_name)
        ghost = await is_agent_ghost(agent_name)
        logger.info("[INVOKE] Ghost check for '%s': %s", agent_name, ghost)
        if ghost:
            logger.info("[INVOKE] Skipping ghost agent '%s'", agent_name)
        else:
            logger.info("[INVOKE] Broadcasting typing=true for '%s'", agent_name)
            await broadcast_event(agent_typing_event(agent_name, channel_id, True))
            prompt = format_invocation_prompt(sender_name, channel_name, content)
            logger.info("[INVOKE] Calling invoke_agent_async for '%s'...", agent_name)
            ok = await invoke_agent_async(
                agent_name=agent_name,
                message=prompt,
            )
            logger.info("[INVOKE] invoke_agent_async result for '%s': %s", agent_name, ok)
            if ok:
                invoked.add(agent_name)
                await broadcast_event(agent_typing_event(agent_name, channel_id, False))
                logger.info("[INVOKE] Successfully invoked agent '%s' via DM", agent_name)
            else:
                await broadcast_event(
                    agent_typing_event(
                        agent_name, channel_id, False, error=f"{agent_name} is not reachable"
                    )
                )
                logger.warning("[INVOKE] Agent '%s' not invocable via DM", agent_name)

    # @mentions → invoke each mentioned agent with recent channel context
    if mentions:
        logger.info("[INVOKE] Processing %d @mentions: %s", len(mentions), mentions)
        recent_context = await _fetch_recent_context(channel_id, limit=5)

        for mentioned in mentions:
            if mentioned in invoked:
                logger.info("[INVOKE] Skipping '%s' — already invoked via DM", mentioned)
                continue
            ghost = await is_agent_ghost(mentioned)
            if ghost:
                logger.info("[INVOKE] Skipping ghost agent '%s' via @mention", mentioned)
                continue
            await broadcast_event(agent_typing_event(mentioned, channel_id, True))
            prompt = format_invocation_prompt(
                sender_name,
                channel_name,
                content,
                recent_context=recent_context or None,
            )
            ok = await invoke_agent_async(
                agent_name=mentioned,
                message=prompt,
            )
            if ok:
                invoked.add(mentioned)
                await broadcast_event(agent_typing_event(mentioned, channel_id, False))
                logger.info("[INVOKE] Invoked '%s' via @mention in %s", mentioned, channel_name)
            else:
                await broadcast_event(
                    agent_typing_event(
                        mentioned, channel_id, False, error=f"{mentioned} is not reachable"
                    )
                )
                logger.warning("[INVOKE] Agent '%s' not invocable via @mention", mentioned)

    logger.info("[INVOKE] Invocation complete. Invoked agents: %s", invoked or "none")


@router.get("", response_model=list[MessageResponse])
async def get_messages(
    channel_id: str,
    limit: int = Query(default=50, le=100),
    before: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    # Verify channel exists
    ch = await db.execute(select(Channel).where(Channel.id == channel_id))
    if not ch.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Channel not found")

    query = (
        select(Message, User.name.label("sender_name"))
        .join(User, Message.sender_id == User.id)
        .where(Message.channel_id == channel_id)
    )
    if before:
        # Get the created_at of the 'before' message for cursor pagination
        before_msg = await db.execute(select(Message.created_at).where(Message.id == before))
        before_ts = before_msg.scalar_one_or_none()
        if before_ts:
            query = query.where(Message.created_at < before_ts)

    query = query.order_by(desc(Message.created_at)).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    messages = []
    for msg, sender_name in rows:
        mentions = json.loads(msg.mentions) if msg.mentions else None
        messages.append(
            {
                "id": msg.id,
                "channel_id": msg.channel_id,
                "sender_id": msg.sender_id,
                "sender_name": sender_name,
                "content": msg.content,
                "mentions": mentions,
                "parent_id": msg.parent_id,
                "created_at": msg.created_at,
            }
        )

    return messages


@router.post("", response_model=MessageResponse, status_code=201)
async def send_message(
    channel_id: str,
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    # Verify channel
    ch = await db.execute(select(Channel).where(Channel.id == channel_id))
    if not ch.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Channel not found")

    # Get the human user as sender (for now)
    sender = await db.execute(select(User).where(User.type == "human"))
    user = sender.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="No user onboarded")

    mentions_json = json.dumps(data.mentions) if data.mentions else None

    msg = Message(
        id=str(uuid.uuid4()),
        channel_id=channel_id,
        sender_id=user.id,
        content=data.content,
        mentions=mentions_json,
        created_at=datetime.now(UTC).isoformat(),
    )
    db.add(msg)
    await db.flush()

    # Look up channel name for invocation routing
    ch_name_result = await db.execute(select(Channel.name).where(Channel.id == channel_id))
    channel_name = ch_name_result.scalar_one_or_none()

    # Broadcast new message to WebSocket clients
    await broadcast_event(
        new_message_event(
            message_id=msg.id,
            channel_id=msg.channel_id,
            sender_id=msg.sender_id,
            sender_name=user.name,
            content=msg.content,
            mentions=data.mentions,
            parent_id=msg.parent_id,
            created_at=msg.created_at,
        )
    )

    # Fire-and-forget: invoke agents for DMs and @mentions
    async def _invoke_with_error_handling() -> None:
        try:
            await _invoke_agents_for_message(
                channel_id=channel_id,
                channel_name=channel_name or "",
                content=data.content,
                sender_name=user.display_name or user.name,
                mentions=data.mentions,
            )
        except Exception:
            logger.exception("[INVOKE] Unhandled error in fire-and-forget invocation task")

    asyncio.create_task(_invoke_with_error_handling())

    return {
        "id": msg.id,
        "channel_id": msg.channel_id,
        "sender_id": msg.sender_id,
        "sender_name": user.name,
        "content": msg.content,
        "mentions": data.mentions,
        "parent_id": msg.parent_id,
        "created_at": msg.created_at,
    }
