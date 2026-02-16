from pydantic import BaseModel


class ChannelCreate(BaseModel):
    name: str


class ChannelResponse(BaseModel):
    id: str
    name: str
    type: str
    project_path: str | None = None
    created_by: str
    created_at: str


class ChannelListResponse(BaseModel):
    channels: list[ChannelResponse]
