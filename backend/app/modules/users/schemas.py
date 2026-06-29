from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict


class UserListItem(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )
    id: int
    full_name: str
    email: str
    status: str
    is_active: bool
    role_id: int | None = None
    role_name: str | None = None
    last_login_at: datetime | None = None
    created_at: datetime | None = None


class UserListResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )
    items: list[UserListItem]
    total: int
    page: int
    page_size: int


class UserDetailResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )
    id: int
    full_name: str
    email: str
    status: str
    is_active: bool
    role_id: int | None = None
    role_name: str | None = None
    last_login_at: datetime | None = None
    created_by: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    updated_by: int | None = None


class ChangeRoleRequest(BaseModel):
    role_id: int = Field(gt=0)


class UserActionResponse(BaseModel):
    user_id: int
    message: str

class UserListQueryParams(BaseModel):
    search: str | None = None
    role_id: int | None = None
    status: str | None = None
    page: int = 1
    page_size: int = 10