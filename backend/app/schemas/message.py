from pydantic import BaseModel


class MessageCreate(BaseModel):
    content: str
    mentions: list[str] | None = None


class MessageResponse(BaseModel):
    id: str
    channel_id: str
    sender_id: str
    sender_name: str | None = None
    content: str
    mentions: list[str] | None = None
    parent_id: str | None = None
    created_at: str


class MessageListResponse(BaseModel):
    messages: list[MessageResponse]
    has_more: bool = False
