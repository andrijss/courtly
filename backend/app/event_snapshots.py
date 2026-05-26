"""Serialize ORM rows for event log payloads (full replay)."""

from datetime import datetime, timezone
from typing import Any

from app.models import Booking, Court, Favorite, Permission, Policy, Review, Role, RoleBinding, RolePermission, User


def _dt(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc).isoformat()
    return value.isoformat()


def user_dict(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "password_hash": user.password_hash,
        "role": user.role,
        "phone_encrypted": user.phone_encrypted,
        "must_change_password": user.must_change_password,
        "is_active": user.is_active,
        "created_at": _dt(user.created_at),
    }


def court_dict(court: Court) -> dict[str, Any]:
    return {
        "id": court.id,
        "name": court.name,
        "city": court.city,
        "district": court.district,
        "address": court.address,
        "surface": court.surface,
        "price_per_hour": court.price_per_hour,
        "opening_time": court.opening_time,
        "closing_time": court.closing_time,
        "image_url": court.image_url,
        "owner_id": court.owner_id,
        "latitude": court.latitude,
        "longitude": court.longitude,
        "is_active": court.is_active,
        "created_at": _dt(court.created_at),
    }


def booking_dict(booking: Booking) -> dict[str, Any]:
    return {
        "id": booking.id,
        "court_id": booking.court_id,
        "user_id": booking.user_id,
        "status": booking.status,
        "hold_token": booking.hold_token,
        "held_until": _dt(booking.held_until),
        "starts_at": _dt(booking.starts_at),
        "ends_at": _dt(booking.ends_at),
        "total_price": booking.total_price,
        "canceled_reason": booking.canceled_reason,
        "created_at": _dt(booking.created_at),
    }


def favorite_dict(fav: Favorite) -> dict[str, Any]:
    return {
        "id": fav.id,
        "user_id": fav.user_id,
        "court_id": fav.court_id,
        "created_at": _dt(fav.created_at),
    }


def review_dict(review: Review) -> dict[str, Any]:
    return {
        "id": review.id,
        "user_id": review.user_id,
        "court_id": review.court_id,
        "booking_id": review.booking_id,
        "rating": review.rating,
        "comment": review.comment,
        "created_at": _dt(review.created_at),
        "updated_at": _dt(review.updated_at),
    }


def role_dict(role: Role) -> dict[str, Any]:
    return {"id": role.id, "name": role.name}


def permission_dict(perm: Permission) -> dict[str, Any]:
    return {"id": perm.id, "name": perm.name}


def policy_dict(policy: Policy) -> dict[str, Any]:
    return {
        "id": policy.id,
        "role": policy.role,
        "resource": policy.resource,
        "action": policy.action,
        "effect": policy.effect,
        "condition": policy.condition,
    }


def role_binding_dict(binding: RoleBinding) -> dict[str, Any]:
    return {"id": binding.id, "user_id": binding.user_id, "role_id": binding.role_id}


def role_permission_dict(link: RolePermission) -> dict[str, Any]:
    return {"id": link.id, "role_id": link.role_id, "permission_id": link.permission_id}
