from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.authz import enforce_policy
from app.database import get_db
from app.deps import get_current_user
from app.event_log import EventLogger
from app.event_snapshots import court_dict
from app.models import Court, User
from app.schemas import EmailNotificationRequest, Message, TransferOwnershipRequest

router = APIRouter(prefix="/api/dashboard")
event_logger = EventLogger()


@router.post("/courts/{court_id}/transfer-ownership", response_model=Message)
def transfer_ownership(
    court_id: str,
    payload: TransferOwnershipRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Message:
    court = db.get(Court, court_id)
    if court is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Court not found")
    enforce_policy(db, user, "/courts/:courtId", "update", owner_id=court.owner_id)
    new_owner = db.scalar(select(User).where(User.email == payload.new_owner_email))
    # Anti-enumeration behavior: generic success even if account does not exist.
    if new_owner:
        court.owner_id = new_owner.id
        db.commit()
        db.refresh(court)
        event_logger.append(
            "court.transfer_ownership",
            user.id,
            {"court": court_dict(court), "new_owner_id": new_owner.id, "target_email": payload.new_owner_email},
        )
    else:
        event_logger.append(
            "court.transfer_ownership",
            user.id,
            {"court_id": court_id, "target_email": payload.new_owner_email, "applied": False},
        )
    return Message(message="Transfer request accepted.")


@router.post("/notifications/email", response_model=Message)
def send_email_notifications(
    payload: EmailNotificationRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Message:
    enforce_policy(db, user, "/dashboard/notifications/email", "create")
    # Placeholder dispatch; intended to be integrated with Resend provider.
    event_logger.append("notifications.email_dispatched", user.id, payload.model_dump())
    return Message(message="Notification campaign queued.")
