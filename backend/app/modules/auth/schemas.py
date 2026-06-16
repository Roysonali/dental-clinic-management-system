from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)

    email: EmailStr

    password: str = Field(..., min_length=8)


class RegisterResponse(BaseModel):
    message: str


class UserApprovalResponse(BaseModel):
    message: str

class UserApprovalRequest(BaseModel):
    role_id: int

class PendingUserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    status: str

    class Config:
        from_attributes = True

class LoginResponse(BaseModel):
    access_token: str
    token_type: str

class CurrentUserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    status: str

    class Config:
        from_attributes = True

