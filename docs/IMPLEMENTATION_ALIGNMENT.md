# OpenAPI and Access Matrix Alignment

This document captures implementation-time contract alignment decisions.

## Base Contract

- OpenAPI source: `docs/openapi.courtly.yaml`
- Access extension source: `docs/access_matrix.yaml`

## Implemented as OpenAPI Base

- `/api/health`
- `/api/auth/*` (`login`, `refresh`, `forgot-password`, `reset-password`, `change-password`)
- `/api/courts*` and `/api/courts/{court_id}/availability`
- `/api/bookings/*` (`hold`, `confirm`, `cancel`)
- `/api/me/bookings`, `/api/me/profile`, `/api/me/favorites`, `/api/me/reviews`
- `/api/dashboard/courts/{court_id}/transfer-ownership`
- `/api/dashboard/notifications/email`
- `/api/admin/users`, `/api/admin/roles`, `/api/admin/policies`, `/api/admin/event-log/replay`

## Added to Cover Access Matrix Gaps

- `DELETE /api/me/favorites/{court_id}` (favorites remove)
- `GET /api/me/reviews` (self review list)
- `PATCH /api/me/reviews/{review_id}` (review update)
- `DELETE /api/me/reviews/{review_id}` (review delete)
- `GET /api/me/reviews/public/{court_id}` (public review list)
- `POST /api/me/profile/request-data-deletion` (profile data deletion request)
- `POST /api/admin/users`, `PATCH /api/admin/users/{user_id}`, `DELETE /api/admin/users/{user_id}` (users CRUD)
- `GET /api/admin/policies`, `PATCH /api/admin/policies/{policy_id}`, `DELETE /api/admin/policies/{policy_id}` (policies CRUD)
- `GET /api/admin/permissions`, `POST /api/admin/permissions`, `DELETE /api/admin/permissions/{permission_id}` (permissions CRUD)
- `POST /api/admin/role-bindings`, `DELETE /api/admin/role-bindings/{binding_id}` (bindings CRUD)
- `POST /api/admin/roles/{role_id}/permissions/{permission_id}`, `DELETE /api/admin/roles/{role_id}/permissions/{permission_id}`
- `GET /api/admin/bookings` (list_all bookings)

## Notes

- PII admin projection is non-PII by design (`UserProjection` excludes email/phone).
- Forgot-password and transfer ownership keep anti-enumeration generic responses.

