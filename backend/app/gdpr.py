"""GDPR Article 17 — data deletion request lifecycle and SLA enforcement."""

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.event_log import EventLogger
from app.event_snapshots import user_dict
from app.models import (
    Booking,
    Court,
    DataDeletionRequest,
    Favorite,
    Review,
    RoleBinding,
    User,
)

GDPR_DEADLINE_DAYS = 14

_event_logger = EventLogger()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def seconds_remaining(request: DataDeletionRequest) -> int:
    deadline = _as_aware(request.deadline_at)
    if deadline is None:
        return 0
    return int((deadline - _utcnow()).total_seconds())


def cascade_delete_user(db: Session, user_id: int) -> dict[str, Any] | None:
    """Hard-delete a user and dependent rows. Returns user snapshot for event log."""
    user = db.get(User, user_id)
    if user is None:
        return None
    snapshot = user_dict(user)
    for court in list(db.scalars(select(Court).where(Court.owner_id == user_id))):
        db.execute(delete(Favorite).where(Favorite.court_id == court.id))
        db.execute(delete(Review).where(Review.court_id == court.id))
        db.execute(delete(Booking).where(Booking.court_id == court.id))
        db.delete(court)
    db.execute(delete(RoleBinding).where(RoleBinding.user_id == user_id))
    db.execute(delete(Favorite).where(Favorite.user_id == user_id))
    db.execute(delete(Review).where(Review.user_id == user_id))
    db.execute(delete(Booking).where(Booking.user_id == user_id))
    db.delete(user)
    return snapshot


def get_pending_for_user(db: Session, user_id: int) -> DataDeletionRequest | None:
    return db.scalar(
        select(DataDeletionRequest)
        .where(DataDeletionRequest.user_id == user_id, DataDeletionRequest.status == "pending")
        .order_by(DataDeletionRequest.requested_at.desc())
    )


PROTECTED_ROLES = {"superuser"}


def is_protected(user: User) -> bool:
    return user.role in PROTECTED_ROLES


def create_request(db: Session, user: User, reason: str | None) -> DataDeletionRequest:
    if is_protected(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System-critical accounts cannot be erased via the self-service GDPR flow.",
        )
    existing = get_pending_for_user(db, user.id)
    if existing is not None:
        return existing
    now = _utcnow()
    request = DataDeletionRequest(
        user_id=user.id,
        user_email=user.email,
        user_full_name=user.full_name,
        requested_at=now,
        deadline_at=now + timedelta(days=GDPR_DEADLINE_DAYS),
        status="pending",
        reason=(reason or None),
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    _event_logger.append(
        "gdpr.data_deletion_requested",
        user.id,
        {
            "request_id": request.id,
            "user_id": user.id,
            "deadline_at": request.deadline_at.isoformat(),
            "reason": request.reason,
        },
    )
    return request


def cancel_request(db: Session, request: DataDeletionRequest, actor_id: int, note: str | None = None) -> DataDeletionRequest:
    request.status = "cancelled"
    request.processed_at = _utcnow()
    request.processed_by_user_id = actor_id
    request.processed_note = note
    db.commit()
    db.refresh(request)
    _event_logger.append(
        "gdpr.data_deletion_cancelled",
        actor_id,
        {"request_id": request.id, "user_id": request.user_id, "note": note},
    )
    return request


def approve_request(db: Session, request: DataDeletionRequest, actor_id: int, note: str | None = None) -> DataDeletionRequest:
    target = db.get(User, request.user_id)
    if target is not None and is_protected(target):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot erase a system-critical account.",
        )
    snapshot = cascade_delete_user(db, request.user_id)
    request.status = "approved_executed"
    request.processed_at = _utcnow()
    request.processed_by_user_id = actor_id
    request.processed_note = note
    db.commit()
    db.refresh(request)
    _event_logger.append(
        "admin.user_deleted",
        actor_id,
        {"target_user_id": request.user_id, "via": "gdpr_admin_approved", "user": snapshot},
    )
    _event_logger.append(
        "gdpr.data_deletion_approved",
        actor_id,
        {"request_id": request.id, "user_id": request.user_id, "note": note},
    )
    return request


def sweep_expired(db: Session) -> int:
    """Auto-execute any pending requests whose 14-day SLA has elapsed."""
    now = _utcnow()
    rows = list(
        db.scalars(
            select(DataDeletionRequest).where(
                DataDeletionRequest.status == "pending",
                DataDeletionRequest.deadline_at <= now,
            )
        )
    )
    count = 0
    for request in rows:
        target = db.get(User, request.user_id)
        if target is not None and is_protected(target):
            request.status = "cancelled"
            request.processed_at = now
            request.processed_note = "Auto-cancelled: protected account"
            _event_logger.append(
                "gdpr.data_deletion_cancelled",
                None,
                {"request_id": request.id, "user_id": request.user_id, "via": "protected_account"},
            )
            count += 1
            continue
        snapshot = cascade_delete_user(db, request.user_id)
        request.status = "expired_executed"
        request.processed_at = now
        request.processed_note = "Auto-executed after 14-day SLA"
        _event_logger.append(
            "admin.user_deleted",
            None,
            {"target_user_id": request.user_id, "via": "gdpr_sla_expired", "user": snapshot},
        )
        _event_logger.append(
            "gdpr.data_deletion_auto_executed",
            None,
            {"request_id": request.id, "user_id": request.user_id},
        )
        count += 1
    if count > 0:
        db.commit()
    return count


def serialize(request: DataDeletionRequest) -> dict[str, Any]:
    remaining = seconds_remaining(request) if request.status == "pending" else 0
    return {
        "id": request.id,
        "user_id": request.user_id,
        "user_email": request.user_email,
        "user_full_name": request.user_full_name,
        "requested_at": request.requested_at,
        "deadline_at": request.deadline_at,
        "status": request.status,
        "reason": request.reason,
        "processed_at": request.processed_at,
        "processed_by_user_id": request.processed_by_user_id,
        "processed_note": request.processed_note,
        "seconds_remaining": remaining,
        "deadline_days_total": GDPR_DEADLINE_DAYS,
    }
