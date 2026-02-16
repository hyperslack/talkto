from pydantic import BaseModel


class AgentResponse(BaseModel):
    id: str
    agent_name: str
    agent_type: str
    project_path: str
    project_name: str
    status: str
    description: str | None = None
    personality: str | None = None
    current_task: str | None = None
    gender: str | None = None
    server_url: str | None = None
    provider_session_id: str | None = None
    is_ghost: bool = False


class AgentListResponse(BaseModel):
    agents: list[AgentResponse]
