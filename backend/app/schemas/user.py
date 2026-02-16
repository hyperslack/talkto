from pydantic import BaseModel


class UserOnboard(BaseModel):
    name: str
    display_name: str | None = None
    about: str | None = None
    agent_instructions: str | None = None


class UserResponse(BaseModel):
    id: str
    name: str
    type: str
    created_at: str
    display_name: str | None = None
    about: str | None = None
    agent_instructions: str | None = None
