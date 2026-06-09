"""Auth routes: sign up, log in, and 'who am I'. Email + password."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select

from ..db.models import User
from ..db.session import get_session
from ..deps import get_current_user
from ..security import create_session_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    token: str
    user_id: int
    email: str
    name: str


class UserResponse(BaseModel):
    id: int
    email: str
    name: str


@router.post("/signup", response_model=TokenResponse)
def signup(body: SignupRequest, session: Session = Depends(get_session)) -> TokenResponse:
    existing = session.exec(select(User).where(User.email == body.email)).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    if len(body.password) < 8:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password must be at least 8 characters")
    user = User(email=body.email, password_hash=hash_password(body.password), name=body.name)
    session.add(user)
    session.commit()
    session.refresh(user)
    return TokenResponse(
        token=create_session_token(user.id), user_id=user.id, email=user.email, name=user.name
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, session: Session = Depends(get_session)) -> TokenResponse:
    user = session.exec(select(User).where(User.email == body.email)).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return TokenResponse(
        token=create_session_token(user.id), user_id=user.id, email=user.email, name=user.name
    )


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(id=user.id, email=user.email, name=user.name)
