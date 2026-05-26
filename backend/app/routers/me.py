from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.authz import enforce_policy
from app.crypto import PIIEncryptor
from app.database import get_db
from app.deps import get_current_user
from app.event_log import EventLogger
from app.event_snapshots import favorite_dict, review_dict, user_dict
from app.models import Booking, Favorite, Review, User
from app.schemas import (
    FavoriteRequest,
    FavoriteResponse,
    Message,
    ModeratorMessageRequest,
    ProfileSelf,
    ProfileUpdateRequest,
    ReviewCreateRequest,
    ReviewResponse,
    ReviewUpdateRequest,
)

router = APIRouter(prefix="/api/me")
event_logger = EventLogger()
encryptor = PIIEncryptor()


@router.get("/bookings", response_model=list[dict])
def my_bookings(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    enforce_policy(db, user, "/me/bookings", "read", owner_id=user.id)
    bookings = list(db.scalars(select(Booking).where(Booking.user_id == user.id).order_by(Booking.starts_at.desc())))
    return [
        {
            "id": b.id,
            "court_id": b.court_id,
            "court_name": b.court.name if b.court else b.court_id,
            "status": b.status,
            "starts_at": b.starts_at,
            "ends_at": b.ends_at,
            "total_price": b.total_price,
        }
        for b in bookings
    ]


@router.get("/bookings/{booking_id}", response_model=dict)
def booking_detail(booking_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    enforce_policy(db, user, "/me/bookings/:bookingId", "read", owner_id=booking.user_id)
    reviews = list(db.scalars(select(Review).where(Review.court_id == booking.court_id).order_by(Review.created_at.desc()).limit(5)))
    return {
        "id": booking.id,
        "court_id": booking.court_id,
        "court_name": booking.court.name if booking.court else booking.court_id,
        "court_address": booking.court.address if booking.court else "",
        "court_surface": booking.court.surface if booking.court else "",
        "status": booking.status,
        "starts_at": booking.starts_at,
        "ends_at": booking.ends_at,
        "total_price": booking.total_price,
        "reviews": [
            {
                "id": review.id,
                "rating": review.rating,
                "comment": review.comment,
                "created_at": review.created_at,
            }
            for review in reviews
        ],
    }


@router.get("/profile", response_model=ProfileSelf)
def profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ProfileSelf:
    enforce_policy(db, user, "/me/profile", "read", owner_id=user.id)
    return ProfileSelf(
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        phone=encryptor.decrypt(user.phone_encrypted),
    )


@router.patch("/profile", response_model=ProfileSelf)
def update_profile(
    payload: ProfileUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ProfileSelf:
    enforce_policy(db, user, "/me/profile", "update", owner_id=user.id)
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.phone is not None:
        user.phone_encrypted = encryptor.encrypt(payload.phone)
    db.commit()
    db.refresh(user)
    event_logger.append("profile.updated", user.id, {"user": user_dict(user)})
    return profile(user, db)


@router.post("/profile/request-data-deletion", response_model=Message)
def request_data_deletion(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Message:
    enforce_policy(db, user, "/me/profile/request-data-deletion", "create", owner_id=user.id)
    event_logger.append("profile.data_deletion_requested", user.id, {})
    return Message(message="Data deletion request has been accepted.")


@router.post("/moderator-message", response_model=Message)
def message_moderator(
    payload: ModeratorMessageRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Message:
    enforce_policy(db, user, "/me/moderator-message", "create", owner_id=user.id)
    event_logger.append(
        "moderator.message_sent",
        user.id,
        {
            "booking_id": payload.booking_id,
            "court_id": payload.court_id,
            "subject": payload.subject,
            "message": payload.message,
        },
    )
    return Message(message="Message sent to moderator.")


@router.get("/favorites", response_model=list[FavoriteResponse])
def list_favorites(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[FavoriteResponse]:
    enforce_policy(db, user, "/me/favorites", "read", owner_id=user.id)
    return list(db.scalars(select(Favorite).where(Favorite.user_id == user.id)))


@router.post("/favorites", response_model=FavoriteResponse, status_code=status.HTTP_201_CREATED)
def add_favorite(
    payload: FavoriteRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> FavoriteResponse:
    enforce_policy(db, user, "/me/favorites", "create", owner_id=user.id)
    existing = db.scalar(select(Favorite).where(Favorite.user_id == user.id, Favorite.court_id == payload.court_id))
    if existing:
        return existing
    favorite = Favorite(user_id=user.id, court_id=payload.court_id)
    db.add(favorite)
    db.commit()
    db.refresh(favorite)
    event_logger.append("favorite.added", user.id, {"favorite": favorite_dict(favorite)})
    return favorite


@router.delete("/favorites/{court_id}", response_model=Message)
def remove_favorite(court_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Message:
    enforce_policy(db, user, "/me/favorites/:courtId", "delete", owner_id=user.id)
    favorite = db.scalar(select(Favorite).where(Favorite.user_id == user.id, Favorite.court_id == court_id))
    if favorite:
        snap = favorite_dict(favorite)
        db.delete(favorite)
        db.commit()
        event_logger.append("favorite.removed", user.id, {"favorite": snap})
    return Message(message="Favorite removed.")


@router.post("/reviews", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review(
    payload: ReviewCreateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ReviewResponse:
    enforce_policy(db, user, "/me/reviews", "create", owner_id=user.id)
    booking = db.get(Booking, payload.booking_id)
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if booking.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can review only your booking")
    if booking.court_id != payload.court_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking does not belong to selected court")
    existing = db.scalar(select(Review).where(Review.user_id == user.id, Review.booking_id == payload.booking_id))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Review for this booking already exists")
    review = Review(user_id=user.id, **payload.model_dump())
    db.add(review)
    db.commit()
    db.refresh(review)
    event_logger.append("review.created", user.id, {"review": review_dict(review)})
    return review


@router.get("/reviews", response_model=list[ReviewResponse])
def list_my_reviews(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ReviewResponse]:
    return list(db.scalars(select(Review).where(Review.user_id == user.id).order_by(Review.created_at.desc())))


@router.patch("/reviews/{review_id}", response_model=ReviewResponse)
def update_review(
    review_id: int, payload: ReviewUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ReviewResponse:
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    enforce_policy(db, user, "/me/reviews", "create", owner_id=review.user_id)
    if payload.rating is not None:
        review.rating = payload.rating
    if payload.comment is not None:
        review.comment = payload.comment
    review.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(review)
    event_logger.append("review.updated", user.id, {"review": review_dict(review)})
    return review


@router.delete("/reviews/{review_id}", response_model=Message)
def delete_review(review_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Message:
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    enforce_policy(db, user, "/me/reviews", "create", owner_id=review.user_id)
    snap = review_dict(review)
    db.delete(review)
    db.commit()
    event_logger.append("review.deleted", user.id, {"review": snap})
    return Message(message="Review deleted.")


@router.get("/reviews/public/{court_id}", response_model=list[ReviewResponse])
def list_public_reviews(court_id: str, db: Session = Depends(get_db), limit: int = Query(default=20, ge=1, le=100)) -> list[ReviewResponse]:
    return list(db.scalars(select(Review).where(Review.court_id == court_id).order_by(Review.created_at.desc()).limit(limit)))
