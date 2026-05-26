from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Policy, User


ROLE_LEVEL = {
    "guest": 0,
    "user": 1,
    "moderator": 2,
    "admin": 3,
    "superuser": 4,
}


def require_role(user: User, minimum: str) -> None:
    if ROLE_LEVEL.get(user.role, 0) < ROLE_LEVEL[minimum]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")


def ensure_owner_or_admin(user: User, owner_id: int) -> None:
    if user.id != owner_id and user.role not in {"admin", "superuser"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def ensure_court_owner_or_admin(user: User, owner_id: int) -> None:
    if user.id != owner_id and user.role not in {"admin", "superuser"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def _parse_ownership(condition: str) -> str:
    normalized = (condition or "").strip().lower()
    if "ownership:self" in normalized or normalized == "self":
        return "self"
    return "all"


def enforce_policy(
    db: Session,
    user: User,
    resource: str,
    action: str,
    owner_id: int | None = None,
) -> None:
    if user.role == "superuser":
        return
    policy = db.scalar(
        select(Policy).where(
            Policy.role == user.role,
            Policy.resource == resource,
            Policy.action == action,
            Policy.effect == "allow",
        )
    )
    if policy is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden by policy")
    if _parse_ownership(policy.condition) == "self" and owner_id is not None and owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden by ownership policy")
