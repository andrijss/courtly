# Courtly Full Specification

## 1. Document Purpose
This specification defines the full-scope implementation for Courtly as a tennis-court booking platform with:
- multi-role authorization (Guest, User, Moderator, Admin, Superuser),
- dynamic RBAC + policy-based ownership controls,
- encrypted PII at rest,
- append-only encrypted event log with database replay capability,
- week/day slot calendar with hold-based booking conflicts.

## 2. Product Vision
Courtly provides a fast path from intent ("I want to play") to confirmed booking:
1. find a court (city, district, map, nearest),
2. choose slots (30 min granularity, minimum 1 hour),
3. confirm and manage bookings.

Design language source of truth: `DESIGN_LANGUAGE.md`.

## 3. Roles and Core Capabilities
- **Guest**
  - browse courts, map, public availability.
- **User**
  - guest permissions +
  - create/confirm/cancel own bookings, manage own profile, favorites, reviews.
- **Moderator**
  - user permissions +
  - manage own courts, pricing, schedules, transfer ownership by email (anti-enumeration), send user notifications.
- **Admin**
  - all moderator permissions +
  - manage all courts and users, configure roles/permissions/policies dynamically.
- **Superuser**
  - bootstrap authority: create/revoke admins and initialize security-critical settings.

## 4. Functional Requirements

### 4.1 Discovery and Court Catalog
- System shall support filtering by city and district.
- System shall provide nearest courts based on user coordinates.
- System shall provide list/map synchronized interactions.
- Court detail shall include: name, location, district, working hours, pricing, surface, indoor/outdoor, media, rating, reviews.

### 4.2 Calendar and Slots
- System shall provide **week and day calendar modes** with user toggle.
- Slot granularity shall be **30 minutes**.
- Minimum booking duration shall be **60 minutes**.
- Slot states shall include: `free`, `held`, `booked`, `disabled`, `past`.
- Day and week views shall expose availability consistently.

### 4.3 Booking Lifecycle
- Booking flow states:
  - `draft_hold` -> `confirmed` -> `active` -> `completed` or `cancelled`.
- Booking conflict model shall use **short hold timeout**:
  - selected slots are held for configurable window (default 5 minutes),
  - expired holds automatically release slots.
- Confirm endpoint shall reject stale/expired holds.
- Users may cancel own bookings based on cancellation policy.

### 4.4 User Cabinet
- User shall view active and past bookings.
- User shall manage favorites and reviews.
- User shall view and update own profile data.
- User shall submit personal data deletion request.

### 4.5 Moderator/Admin Dashboard
- Shared dashboard UI with role-aware features.
- Moderator shall CRUD only owned courts.
- Admin shall CRUD all courts and users.
- Admin shall create/update/delete roles, permissions, policies, role bindings.
- Ownership transfer by email shall not expose user existence.

### 4.6 Notifications
- System shall support email notifications via Resend adapter.
- Moderator and Admin may initiate predefined notification campaigns/templates.
- System shall support authentication email flows, including password recovery emails.

### 4.7 Forgot Password (User)
- System shall provide `forgot password` flow for users.
- User submits account email to password recovery endpoint.
- System sends password reset email with one-time token/link.
- Request endpoint must return generic success response regardless of email existence (anti-enumeration).
- Reset token shall be short-lived and single-use.
- User can set a new password via token confirmation endpoint.

### 4.8 Event Logging and Recovery
- Every write operation (except reads) shall append event to `event_log.jsonl`.
- Event log shall support full DB rebuild through replay tool.
- Replay shall be deterministic and idempotent for same event stream.

## 5. Non-Functional Requirements

### 5.1 Performance
- API P95 latency targets (baseline):
  - read endpoints: <= 300 ms,
  - write endpoints: <= 500 ms,
  - booking confirmation: <= 700 ms with conflict checks.
- Calendar availability queries shall support 7-day window without full table scans.

### 5.2 Reliability
- Event log writes shall be atomic (append-only, no in-place mutation).
- System shall guarantee booking integrity under concurrent requests.
- Replay tooling shall recreate DB from empty state and complete without manual intervention.

### 5.3 Security and Privacy
- PII fields (`full_name`, `email`, `phone`) encrypted at rest.
- Admin and Moderator shall never receive PII plaintext from API.
- Transfer ownership API shall prevent user enumeration.

### 5.4 Auditability
- Authorization decisions shall be auditable with actor, action, resource, decision.
- Event stream shall include hash chaining for tamper evidence.

### 5.5 Maintainability
- Backend and frontend follow modular monorepo structure.
- Migrations managed via Alembic.
- TDD required for critical business modules.

## 6. Security Requirements

### 6.1 Authentication
- JWT access + refresh tokens.
- Passwords hashed using Argon2id.
- Forced password change for seeded superuser credentials.
- Password reset flow with signed one-time token delivered by email.
- Password reset request endpoint must be enumeration-safe.

### 6.2 Authorization
- Hybrid model:
  - RBAC base (role -> permission).
  - Policy layer for ownership/context rules.
- Explicit deny must override allow.
- Policy decisions logged for audit.

### 6.3 Encryption and Key Management
- Envelope encryption with AES-256-GCM payload encryption.
- Per-record DEK encrypted by KEK.
- Every encrypted record includes `key_version`.
- Key rotation must support re-encryption workflow without downtime.

### 6.4 PII Access Policy
- User can access own PII.
- Moderator/Admin/Superuser dashboards use non-PII projections only.
- Event log payload includes encrypted PII only.

### 6.5 Anti-Enumeration
- Ownership transfer response must be generic regardless of target email existence.
- Notification and transfer flows must not expose account existence in errors.

## 7. Data Requirements (high-level)
- Core entities: users, roles, permissions, policies, policy_bindings.
- Courts domain: courts, court_ownership, court_pricing, court_availability, court_media.
- Booking domain: bookings, booking_slots, booking_status_history, slot_holds.
- User interactions: favorites, reviews, notifications.
- Audit domain: audit_events + file-based event log.
- Key metadata: key_versions.

## 8. API Requirements (high-level)
- `/auth/*`: register/login/refresh/change-password.
- `/courts/*`: list/filter/detail/create/update/delete.
- `/courts/{id}/availability`: week/day availability with slot states.
- `/bookings/*`: hold/confirm/cancel/list.
- `/me/*`: profile, bookings, favorites, reviews, deletion request.
- `/dashboard/*`: moderator/admin operations.
- `/admin/*`: role/permission/policy management and user management.

Detailed protocol: see `docs/openapi.courtly.yaml`.

## 9. Development Phases

### Phase 1: Platform Foundation
- Backend/FastAPI setup, frontend/Vite setup, config/env, DB connection.
- CI for pytest and frontend checks.

### Phase 2: Data Model + Migrations
- SQLAlchemy models and Alembic migrations for all core domains.

### Phase 3: Crypto + AuthN/AuthZ
- JWT auth, Argon2id, encryption layer, key versioning.
- RBAC/policy evaluator and guards.

### Phase 4: Courts + Calendar + Booking Engine
- Discovery, court details, day/week calendar.
- Hold timeout engine and confirm/cancel flows.

### Phase 5: Cabinet + Dashboard
- User cabinet features.
- Moderator/Admin dashboard operations and ownership transfer.

### Phase 6: Event Log + Replay + Hardening
- Append-only encrypted event log with hash chain.
- Replay tool and deterministic restore tests.

### Phase 7: Security and Regression QA
- No-PII exposure tests, anti-enumeration tests, policy matrix tests.
- Load and concurrency tests for slot conflicts.

## 10. Testing Strategy (TDD)
- Mandatory workflow per feature:
  1. write blackbox API tests,
  2. write unit tests for business logic,
  3. implement minimum code to pass,
  4. refactor and rerun suite.
- Required test families:
  - auth and token lifecycle,
  - role/permission/policy matrix,
  - ownership constraints,
  - slot hold expiry and concurrent booking conflict,
  - PII redaction/non-exposure,
  - event log integrity and replay.

## 11. Acceptance Criteria
- Week/day calendars with correct free/held/booked states.
- Booking enforces 30-minute slots and minimum 1 hour.
- Hold timeout behavior is deterministic and tested.
- Dynamic RBAC/policy configuration available to admin.
- Moderator/admin never receive PII fields.
- Event log replay fully restores operational DB state.
