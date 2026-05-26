import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.database import engine
from app.models import (
    Booking,
    Court,
    Favorite,
    Permission,
    Policy,
    Review,
    Role,
    RoleBinding,
    RolePermission,
    User,
)

ReplayFn = Callable[[Session, dict[str, Any]], None]


def _delete_court_tree(db: Session, court_id: str) -> None:
    db.execute(delete(Favorite).where(Favorite.court_id == court_id))
    db.execute(delete(Review).where(Review.court_id == court_id))
    db.execute(delete(Booking).where(Booking.court_id == court_id))
    court = db.get(Court, court_id)
    if court:
        db.delete(court)


def _parse_dt(raw: str | datetime | None) -> datetime | None:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw
    s = raw.replace("Z", "+00:00") if isinstance(raw, str) else raw
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _upsert_user(db: Session, row: dict[str, Any]) -> None:
    uid = row["id"]
    obj = db.get(User, uid)
    if obj is None:
        obj = User(id=uid)
        db.add(obj)
    obj.email = row["email"]
    obj.full_name = row["full_name"]
    obj.password_hash = row["password_hash"]
    obj.role = row["role"]
    obj.phone_encrypted = row.get("phone_encrypted")
    obj.must_change_password = row.get("must_change_password", False)
    obj.is_active = row.get("is_active", True)
    if row.get("created_at"):
        obj.created_at = _parse_dt(row["created_at"]) or obj.created_at


def _upsert_court(db: Session, row: dict[str, Any]) -> None:
    cid = row["id"]
    obj = db.get(Court, cid)
    if obj is None:
        obj = Court(id=cid)
        db.add(obj)
    obj.name = row["name"]
    obj.city = row["city"]
    obj.district = row["district"]
    obj.address = row["address"]
    obj.surface = row["surface"]
    obj.price_per_hour = row["price_per_hour"]
    obj.opening_time = row.get("opening_time", "07:00")
    obj.closing_time = row.get("closing_time", "22:00")
    obj.image_url = row.get("image_url")
    obj.owner_id = row["owner_id"]
    obj.latitude = row.get("latitude")
    obj.longitude = row.get("longitude")
    obj.is_active = row.get("is_active", True)
    if row.get("created_at"):
        obj.created_at = _parse_dt(row["created_at"]) or obj.created_at


def _upsert_booking(db: Session, row: dict[str, Any]) -> None:
    bid = row["id"]
    obj = db.get(Booking, bid)
    if obj is None:
        obj = Booking(id=bid)
        db.add(obj)
    obj.court_id = row["court_id"]
    obj.user_id = row["user_id"]
    obj.status = row["status"]
    obj.hold_token = row.get("hold_token")
    obj.held_until = _parse_dt(row.get("held_until"))
    obj.starts_at = _parse_dt(row["starts_at"])
    obj.ends_at = _parse_dt(row["ends_at"])
    obj.total_price = row["total_price"]
    obj.canceled_reason = row.get("canceled_reason")
    if row.get("created_at"):
        obj.created_at = _parse_dt(row["created_at"]) or obj.created_at


def _upsert_favorite(db: Session, row: dict[str, Any]) -> None:
    fid = row["id"]
    obj = db.get(Favorite, fid)
    if obj is None:
        obj = Favorite(id=fid)
        db.add(obj)
    obj.user_id = row["user_id"]
    obj.court_id = row["court_id"]
    if row.get("created_at"):
        obj.created_at = _parse_dt(row["created_at"]) or obj.created_at


def _upsert_review(db: Session, row: dict[str, Any]) -> None:
    rid = row["id"]
    obj = db.get(Review, rid)
    if obj is None:
        obj = Review(id=rid)
        db.add(obj)
    obj.user_id = row["user_id"]
    obj.court_id = row["court_id"]
    obj.booking_id = row.get("booking_id")
    obj.rating = row["rating"]
    obj.comment = row["comment"]
    if row.get("created_at"):
        obj.created_at = _parse_dt(row["created_at"]) or obj.created_at
    if row.get("updated_at"):
        obj.updated_at = _parse_dt(row["updated_at"]) or obj.updated_at


def _upsert_role(db: Session, row: dict[str, Any]) -> None:
    rid = row["id"]
    obj = db.get(Role, rid)
    if obj is None:
        obj = Role(id=rid, name=row["name"])
        db.add(obj)
    else:
        obj.name = row["name"]


def _upsert_permission(db: Session, row: dict[str, Any]) -> None:
    pid = row["id"]
    obj = db.get(Permission, pid)
    if obj is None:
        obj = Permission(id=pid, name=row["name"])
        db.add(obj)
    else:
        obj.name = row["name"]


def _upsert_policy(db: Session, row: dict[str, Any]) -> None:
    pid = row["id"]
    obj = db.get(Policy, pid)
    if obj is None:
        obj = Policy(id=pid)
        db.add(obj)
    obj.role = row["role"]
    obj.resource = row["resource"]
    obj.action = row["action"]
    obj.effect = row.get("effect", "allow")
    obj.condition = row.get("condition", "")


def _upsert_role_binding(db: Session, row: dict[str, Any]) -> None:
    bid = row["id"]
    obj = db.get(RoleBinding, bid)
    if obj is None:
        obj = RoleBinding(id=bid)
        db.add(obj)
    obj.user_id = row["user_id"]
    obj.role_id = row["role_id"]


def _upsert_role_permission(db: Session, row: dict[str, Any]) -> None:
    lid = row["id"]
    obj = db.get(RolePermission, lid)
    if obj is None:
        obj = RolePermission(id=lid)
        db.add(obj)
    obj.role_id = row["role_id"]
    obj.permission_id = row["permission_id"]


def _replay_auth_register(db: Session, p: dict[str, Any]) -> None:
    row = p.get("user")
    if not row:
        return
    _upsert_user(db, row)


def _replay_auth_reset_password(db: Session, p: dict[str, Any]) -> None:
    row = p.get("user")
    if not row:
        return
    _upsert_user(db, row)


def _replay_auth_change_password(db: Session, p: dict[str, Any]) -> None:
    row = p.get("user")
    if not row:
        return
    _upsert_user(db, row)


def _replay_admin_user_created(db: Session, p: dict[str, Any]) -> None:
    row = p.get("user")
    if not row:
        return
    _upsert_user(db, row)


def _replay_admin_user_updated(db: Session, p: dict[str, Any]) -> None:
    row = p.get("user")
    if not row:
        return
    _upsert_user(db, row)


def _replay_admin_user_deleted(db: Session, p: dict[str, Any]) -> None:
    uid = p.get("target_user_id")
    if uid is None:
        return
    for court in list(db.scalars(select(Court).where(Court.owner_id == uid))):
        _delete_court_tree(db, court.id)
    db.execute(delete(RoleBinding).where(RoleBinding.user_id == uid))
    db.execute(delete(Favorite).where(Favorite.user_id == uid))
    db.execute(delete(Review).where(Review.user_id == uid))
    db.execute(delete(Booking).where(Booking.user_id == uid))
    model = db.get(User, uid)
    if model:
        db.delete(model)


def _replay_rbac_role_created(db: Session, p: dict[str, Any]) -> None:
    row = p.get("role")
    if not row:
        return
    _upsert_role(db, row)


def _replay_rbac_role_deleted(db: Session, p: dict[str, Any]) -> None:
    rid = p.get("role_id")
    if rid is None:
        return
    db.execute(delete(RoleBinding).where(RoleBinding.role_id == rid))
    db.execute(delete(RolePermission).where(RolePermission.role_id == rid))
    model = db.get(Role, rid)
    if model:
        db.delete(model)


def _replay_rbac_permission_created(db: Session, p: dict[str, Any]) -> None:
    row = p.get("permission")
    if not row:
        return
    _upsert_permission(db, row)


def _replay_rbac_permission_deleted(db: Session, p: dict[str, Any]) -> None:
    pid = p.get("permission_id")
    if pid is None:
        return
    db.execute(delete(RolePermission).where(RolePermission.permission_id == pid))
    model = db.get(Permission, pid)
    if model:
        db.delete(model)


def _replay_rbac_policy_created(db: Session, p: dict[str, Any]) -> None:
    row = p.get("policy")
    if not row:
        return
    _upsert_policy(db, row)


def _replay_rbac_policy_updated(db: Session, p: dict[str, Any]) -> None:
    row = p.get("policy")
    if not row:
        return
    _upsert_policy(db, row)


def _replay_rbac_policy_deleted(db: Session, p: dict[str, Any]) -> None:
    pid = p.get("policy_id")
    if pid is None:
        return
    model = db.get(Policy, pid)
    if model:
        db.delete(model)


def _replay_rbac_role_bound(db: Session, p: dict[str, Any]) -> None:
    row = p.get("binding")
    if not row:
        return
    _upsert_role_binding(db, row)


def _replay_rbac_role_unbound(db: Session, p: dict[str, Any]) -> None:
    bid = p.get("binding_id")
    if bid is None:
        return
    model = db.get(RoleBinding, bid)
    if model:
        db.delete(model)


def _replay_rbac_permission_bound(db: Session, p: dict[str, Any]) -> None:
    row = p.get("role_permission")
    if not row:
        role_id, perm_id = p.get("role_id"), p.get("permission_id")
        if role_id is None or perm_id is None:
            return
        existing = db.scalar(
            select(RolePermission).where(RolePermission.role_id == role_id, RolePermission.permission_id == perm_id)
        )
        if existing:
            return
        db.add(RolePermission(role_id=role_id, permission_id=perm_id))
        return
    _upsert_role_permission(db, row)


def _replay_rbac_permission_unbound(db: Session, p: dict[str, Any]) -> None:
    role_id, perm_id = p.get("role_id"), p.get("permission_id")
    if role_id is None or perm_id is None:
        return
    link = db.scalar(select(RolePermission).where(RolePermission.role_id == role_id, RolePermission.permission_id == perm_id))
    if link:
        db.delete(link)


def _replay_court_created(db: Session, p: dict[str, Any]) -> None:
    row = p.get("court")
    if not row:
        return
    _upsert_court(db, row)


def _replay_court_updated(db: Session, p: dict[str, Any]) -> None:
    row = p.get("court")
    if not row:
        return
    _upsert_court(db, row)


def _replay_court_image_uploaded(db: Session, p: dict[str, Any]) -> None:
    row = p.get("court")
    if not row:
        return
    _upsert_court(db, row)


def _replay_court_deleted(db: Session, p: dict[str, Any]) -> None:
    cid = p.get("court_id")
    if cid is None:
        return
    _delete_court_tree(db, cid)


def _replay_court_transfer_ownership(db: Session, p: dict[str, Any]) -> None:
    if p.get("applied") is False:
        return
    row = p.get("court")
    if row:
        _upsert_court(db, row)
        return
    cid, new_owner_id = p.get("court_id"), p.get("new_owner_id")
    if cid is None or new_owner_id is None:
        return
    court = db.get(Court, cid)
    if court:
        court.owner_id = new_owner_id


def _replay_booking_hold_created(db: Session, p: dict[str, Any]) -> None:
    row = p.get("booking")
    if not row:
        return
    _upsert_booking(db, row)


def _replay_booking_confirmed(db: Session, p: dict[str, Any]) -> None:
    row = p.get("booking")
    if row:
        _upsert_booking(db, row)
        return
    bid = p.get("booking_id")
    if bid is None:
        return
    b = db.get(Booking, bid)
    if b:
        b.status = "confirmed"
        b.hold_token = None
        b.held_until = None


def _replay_booking_cancelled(db: Session, p: dict[str, Any]) -> None:
    row = p.get("booking")
    if row:
        _upsert_booking(db, row)
        return
    bid = p.get("booking_id")
    if bid is None:
        return
    b = db.get(Booking, bid)
    if b:
        b.status = "cancelled"
        b.canceled_reason = p.get("reason")
        b.hold_token = None
        b.held_until = None


def _replay_favorite_added(db: Session, p: dict[str, Any]) -> None:
    row = p.get("favorite")
    if not row:
        return
    _upsert_favorite(db, row)


def _replay_favorite_removed(db: Session, p: dict[str, Any]) -> None:
    fav_id = p.get("favorite_id")
    if fav_id is not None:
        fav = db.get(Favorite, fav_id)
        if fav:
            db.delete(fav)
        return
    user_id, court_id = p.get("user_id"), p.get("court_id")
    if user_id is None or court_id is None:
        return
    fav = db.scalar(select(Favorite).where(Favorite.user_id == user_id, Favorite.court_id == court_id))
    if fav:
        db.delete(fav)


def _replay_review_created(db: Session, p: dict[str, Any]) -> None:
    row = p.get("review")
    if not row:
        return
    _upsert_review(db, row)


def _replay_review_updated(db: Session, p: dict[str, Any]) -> None:
    row = p.get("review")
    if not row:
        return
    _upsert_review(db, row)


def _replay_review_deleted(db: Session, p: dict[str, Any]) -> None:
    row = p.get("review")
    rid = row["id"] if row else p.get("review_id")
    if rid is None:
        return
    rev = db.get(Review, rid)
    if rev:
        db.delete(rev)


def _replay_profile_updated(db: Session, p: dict[str, Any]) -> None:
    row = p.get("user")
    if not row:
        return
    _upsert_user(db, row)


MUTATION_HANDLERS: dict[str, ReplayFn] = {
    "auth.register": _replay_auth_register,
    "auth.reset_password": _replay_auth_reset_password,
    "auth.change_password": _replay_auth_change_password,
    "admin.user_created": _replay_admin_user_created,
    "admin.user_updated": _replay_admin_user_updated,
    "admin.user_deleted": _replay_admin_user_deleted,
    "rbac.role_created": _replay_rbac_role_created,
    "rbac.role_deleted": _replay_rbac_role_deleted,
    "rbac.permission_created": _replay_rbac_permission_created,
    "rbac.permission_deleted": _replay_rbac_permission_deleted,
    "rbac.policy_created": _replay_rbac_policy_created,
    "rbac.policy_updated": _replay_rbac_policy_updated,
    "rbac.policy_deleted": _replay_rbac_policy_deleted,
    "rbac.role_bound": _replay_rbac_role_bound,
    "rbac.role_unbound": _replay_rbac_role_unbound,
    "rbac.permission_bound": _replay_rbac_permission_bound,
    "rbac.permission_unbound": _replay_rbac_permission_unbound,
    "court.created": _replay_court_created,
    "court.updated": _replay_court_updated,
    "court.image_uploaded": _replay_court_image_uploaded,
    "court.deleted": _replay_court_deleted,
    "court.transfer_ownership": _replay_court_transfer_ownership,
    "booking.hold_created": _replay_booking_hold_created,
    "booking.confirmed": _replay_booking_confirmed,
    "booking.cancelled": _replay_booking_cancelled,
    "favorite.added": _replay_favorite_added,
    "favorite.removed": _replay_favorite_removed,
    "review.created": _replay_review_created,
    "review.updated": _replay_review_updated,
    "review.deleted": _replay_review_deleted,
    "profile.updated": _replay_profile_updated,
}


def _resync_sqlite_sequences(db: Session) -> None:
    if not str(engine.url).startswith("sqlite"):
        return
    has_seq = db.scalar(text("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'"))
    if not has_seq:
        return
    for model in (User, Role, Permission, Policy, Favorite, Review, RoleBinding, RolePermission):
        table = model.__tablename__
        mid = db.scalar(select(func.max(model.id)))
        if mid is None:
            continue
        db.execute(text("DELETE FROM sqlite_sequence WHERE name = :t"), {"t": table})
        db.execute(text("INSERT INTO sqlite_sequence (name, seq) VALUES (:t, :s)"), {"t": table, "s": mid})


def replay_events(path: Path, db: Session) -> int:
    if not path.exists():
        return 0
    count = 0
    with path.open("r", encoding="utf-8") as stream:
        for line in stream:
            if not line.strip():
                continue
            event = json.loads(line)
            event_type = event.get("event_type")
            payload = event.get("payload") or {}
            handler = MUTATION_HANDLERS.get(event_type)
            if handler is not None:
                handler(db, payload)
                db.flush()
            count += 1
    _resync_sqlite_sequences(db)
    db.commit()
    return count
