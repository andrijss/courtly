from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.authz import enforce_policy
from app.crypto import PIIEncryptor
from app.database import get_db
from app.deps import get_current_user
from app.event_log import EventLogger
from app.event_snapshots import (
    permission_dict,
    policy_dict,
    role_binding_dict,
    role_dict,
    role_permission_dict,
    user_dict,
)
from app.models import Booking, Permission, Policy, Role, RoleBinding, RolePermission, User
from app.replay import replay_events
from app.schemas import (
    EventReplayResponse,
    Message,
    PermissionCreateRequest,
    PermissionResponse,
    PolicyRequest,
    PolicyResponse,
    RoleBindingRequest,
    RoleCreateRequest,
    RoleResponse,
    UserCreateRequest,
    UserProjection,
    UserUpdateRequest,
)
from app.security import hash_password

router = APIRouter(prefix="/api/admin")
event_logger = EventLogger()
encryptor = PIIEncryptor()


def _admin_only(user: User) -> None:
    if user.role not in {"admin", "superuser"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")


@router.get("/users", response_model=list[UserProjection])
def list_users(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[UserProjection]:
    _admin_only(user)
    enforce_policy(db, user, "/admin/users", "read")
    return list(db.scalars(select(User).order_by(User.id.asc())))


@router.post("/users", response_model=UserProjection, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserProjection:
    _admin_only(user)
    enforce_policy(db, user, "/admin/users", "create")
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    model = User(
        email=payload.email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role,
        phone_encrypted=encryptor.encrypt(payload.phone) if payload.phone else None,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    event_logger.append("admin.user_created", user.id, {"target_user_id": model.id, "user": user_dict(model)})
    return model


@router.patch("/users/{user_id}", response_model=UserProjection)
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserProjection:
    _admin_only(user)
    enforce_policy(db, user, "/admin/users/:userId", "update")
    model = db.get(User, user_id)
    if model is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    changes = payload.model_dump(exclude_unset=True)
    if "phone" in changes:
        model.phone_encrypted = encryptor.encrypt(changes.pop("phone")) if changes["phone"] else None
    for key, value in changes.items():
        setattr(model, key, value)
    db.commit()
    db.refresh(model)
    event_logger.append("admin.user_updated", user.id, {"target_user_id": model.id, "user": user_dict(model)})
    return model


@router.delete("/users/{user_id}", response_model=Message)
def delete_user(user_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Message:
    _admin_only(user)
    enforce_policy(db, user, "/admin/users/:userId", "delete")
    model = db.get(User, user_id)
    if model is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    db.delete(model)
    db.commit()
    event_logger.append("admin.user_deleted", user.id, {"target_user_id": user_id})
    return Message(message="User deleted.")


@router.get("/roles", response_model=list[RoleResponse])
def list_roles(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[RoleResponse]:
    _admin_only(user)
    enforce_policy(db, user, "/admin/roles", "read")
    return list(db.scalars(select(Role).order_by(Role.name.asc())))


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(payload: RoleCreateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> RoleResponse:
    _admin_only(user)
    enforce_policy(db, user, "/admin/roles", "create")
    role = Role(name=payload.name)
    db.add(role)
    db.commit()
    db.refresh(role)
    event_logger.append("rbac.role_created", user.id, {"role": role_dict(role)})
    return role


@router.delete("/roles/{role_id}", response_model=Message)
def delete_role(role_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Message:
    _admin_only(user)
    enforce_policy(db, user, "/admin/roles/:roleId", "delete")
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    db.delete(role)
    db.commit()
    event_logger.append("rbac.role_deleted", user.id, {"role_id": role_id})
    return Message(message="Role deleted.")


@router.get("/permissions", response_model=list[PermissionResponse])
def list_permissions(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[PermissionResponse]:
    _admin_only(user)
    return list(db.scalars(select(Permission).order_by(Permission.name.asc())))


@router.post("/permissions", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED)
def create_permission(
    payload: PermissionCreateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PermissionResponse:
    _admin_only(user)
    permission = Permission(name=payload.name)
    db.add(permission)
    db.commit()
    db.refresh(permission)
    event_logger.append("rbac.permission_created", user.id, {"permission": permission_dict(permission)})
    return permission


@router.delete("/permissions/{permission_id}", response_model=Message)
def delete_permission(permission_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Message:
    _admin_only(user)
    permission = db.get(Permission, permission_id)
    if permission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    db.delete(permission)
    db.commit()
    event_logger.append("rbac.permission_deleted", user.id, {"permission_id": permission_id})
    return Message(message="Permission deleted.")


@router.get("/policies", response_model=list[PolicyResponse])
def list_policies(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[PolicyResponse]:
    _admin_only(user)
    enforce_policy(db, user, "/admin/policies", "read")
    return list(db.scalars(select(Policy).order_by(Policy.id.asc())))


@router.post("/policies", response_model=PolicyResponse, status_code=status.HTTP_201_CREATED)
def create_policy(payload: PolicyRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> PolicyResponse:
    _admin_only(user)
    enforce_policy(db, user, "/admin/policies", "create")
    policy = Policy(**payload.model_dump())
    db.add(policy)
    db.commit()
    db.refresh(policy)
    event_logger.append("rbac.policy_created", user.id, {"policy": policy_dict(policy)})
    return policy


@router.patch("/policies/{policy_id}", response_model=PolicyResponse)
def update_policy(
    policy_id: int, payload: PolicyRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PolicyResponse:
    _admin_only(user)
    enforce_policy(db, user, "/admin/policies/:policyId", "update")
    policy = db.get(Policy, policy_id)
    if policy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found")
    for key, value in payload.model_dump().items():
        setattr(policy, key, value)
    db.commit()
    db.refresh(policy)
    event_logger.append("rbac.policy_updated", user.id, {"policy": policy_dict(policy)})
    return policy


@router.delete("/policies/{policy_id}", response_model=Message)
def delete_policy(policy_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Message:
    _admin_only(user)
    enforce_policy(db, user, "/admin/policies/:policyId", "delete")
    policy = db.get(Policy, policy_id)
    if policy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found")
    db.delete(policy)
    db.commit()
    event_logger.append("rbac.policy_deleted", user.id, {"policy_id": policy_id})
    return Message(message="Policy deleted.")


@router.post("/role-bindings", response_model=Message, status_code=status.HTTP_201_CREATED)
def create_role_binding(
    payload: RoleBindingRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Message:
    _admin_only(user)
    if db.get(User, payload.user_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if db.get(Role, payload.role_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    binding = RoleBinding(user_id=payload.user_id, role_id=payload.role_id)
    db.add(binding)
    db.commit()
    db.refresh(binding)
    event_logger.append("rbac.role_bound", user.id, {"binding": role_binding_dict(binding)})
    return Message(message="Role binding created.")


@router.delete("/role-bindings/{binding_id}", response_model=Message)
def delete_role_binding(binding_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Message:
    _admin_only(user)
    binding = db.get(RoleBinding, binding_id)
    if binding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Binding not found")
    db.delete(binding)
    db.commit()
    event_logger.append("rbac.role_unbound", user.id, {"binding_id": binding_id})
    return Message(message="Role binding deleted.")


@router.post("/roles/{role_id}/permissions/{permission_id}", response_model=Message)
def bind_permission_to_role(
    role_id: int, permission_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Message:
    _admin_only(user)
    if db.get(Role, role_id) is None or db.get(Permission, permission_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role or permission not found")
    link = RolePermission(role_id=role_id, permission_id=permission_id)
    db.add(link)
    db.commit()
    db.refresh(link)
    event_logger.append("rbac.permission_bound", user.id, {"role_permission": role_permission_dict(link)})
    return Message(message="Permission bound to role.")


@router.delete("/roles/{role_id}/permissions/{permission_id}", response_model=Message)
def unbind_permission_from_role(
    role_id: int, permission_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Message:
    _admin_only(user)
    link = db.scalar(select(RolePermission).where(RolePermission.role_id == role_id, RolePermission.permission_id == permission_id))
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Binding not found")
    db.delete(link)
    db.commit()
    event_logger.append("rbac.permission_unbound", user.id, {"role_id": role_id, "permission_id": permission_id})
    return Message(message="Permission unbound from role.")


@router.get("/bookings", response_model=list[dict])
def list_all_bookings(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    _admin_only(user)
    enforce_policy(db, user, "/admin/bookings", "read")
    bookings = list(db.scalars(select(Booking).order_by(Booking.created_at.desc())))
    return [
        {
            "id": b.id,
            "court_id": b.court_id,
            "user_id": b.user_id,
            "status": b.status,
            "starts_at": b.starts_at,
            "ends_at": b.ends_at,
            "total_price": b.total_price,
        }
        for b in bookings
    ]


@router.post("/event-log/replay", response_model=EventReplayResponse)
def replay_event_log(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> EventReplayResponse:
    _admin_only(user)
    enforce_policy(db, user, "/admin/event-log/replay", "create")
    ok, _ = event_logger.verify_chain()
    if not ok:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Event log integrity check failed")
    count = replay_events(event_logger.path, db)
    event_logger.append("event_log.replayed", user.id, {"events_replayed": count})
    return EventReplayResponse(ok=True, events_replayed=count)
