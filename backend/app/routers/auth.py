from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.event_log import EventLogger
from app.event_snapshots import user_dict
from app.models import User
from app.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    Message,
    RegisterRequest,
    RefreshRequest,
    ResetPasswordRequest,
    TokenPair,
)
from app.security import create_token, decode_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth")
settings = get_settings()
event_logger = EventLogger()


def _token_pair(user: User) -> TokenPair:
    access = create_token(str(user.id), "access", settings.access_token_minutes, extra={"uid": user.id, "role": user.role})
    refresh = create_token(
        str(user.id), "refresh", settings.refresh_token_minutes, extra={"uid": user.id, "role": user.role}
    )
    return TokenPair(access_token=access, refresh_token=refresh, must_change_password=user.must_change_password)


@router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenPair:
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    event_logger.append("auth.login", user.id, {"email": user.email})
    return _token_pair(user)


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenPair:
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    user = User(
        email=payload.email,
        full_name=f"{payload.last_name} {payload.first_name}",
        password_hash=hash_password(payload.password),
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    event_logger.append("auth.register", user.id, {"email": user.email, "user": user_dict(user)})
    return _token_pair(user)


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenPair:
    try:
        token_data = decode_token(payload.refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc
    if token_data.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token required")
    user = db.get(User, token_data.get("uid"))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return _token_pair(user)


@router.post("/forgot-password", response_model=Message)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> Message:
    user = db.scalar(select(User).where(User.email == payload.email))
    event_logger.append("auth.forgot_password", user.id if user else None, {"email": payload.email})
    # Anti-enumeration: always return generic response.
    return Message(message="If this email exists, a reset link has been sent.")


@router.post("/reset-password", response_model=Message)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> Message:
    try:
        token_data = decode_token(payload.token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid reset token") from exc
    user = db.get(User, token_data.get("uid"))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    db.commit()
    db.refresh(user)
    event_logger.append("auth.reset_password", user.id, {"user": user_dict(user)})
    return Message(message="Password reset successfully.")


@router.post("/change-password", response_model=Message)
def change_password(
    payload: ChangePasswordRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Message:
    if not verify_password(payload.old_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Old password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    db.commit()
    db.refresh(user)
    event_logger.append("auth.change_password", user.id, {"user": user_dict(user)})
    return Message(message="Password changed.")

