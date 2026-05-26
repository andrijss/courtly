# Courtly Architecture Diagrams

Набір C-level діаграм (C1-C4) для Courtly у форматі Mermaid.

## C1 — System Context

```mermaid
flowchart LR
  guestUser[GuestUser]
  registeredUser[RegisteredUser]
  moderatorUser[ModeratorUser]
  adminUser[AdminUser]
  superUser[SuperUser]

  courtlySystem[CourtlySystem]
  mapboxApi[MapboxAPI]
  resendApi[ResendAPI]
  emailInbox[EmailInbox]

  guestUser -->|"browse courts availability"| courtlySystem
  registeredUser -->|"book manage account"| courtlySystem
  moderatorUser -->|"manage owned courts send notifications"| courtlySystem
  adminUser -->|"global management policies"| courtlySystem
  superUser -->|"bootstrap admin lifecycle"| courtlySystem

  courtlySystem -->|"map tiles geocoding"| mapboxApi
  courtlySystem -->|"send transactional emails"| resendApi
  resendApi -->|"deliver reset booking emails"| emailInbox
```

## C2 — Container Diagram

```mermaid
flowchart TB
  webClient[ReactViteWebClient]
  fastapiApp[FastAPIApplication]
  sqliteDb[SQLiteDatabase]
  eventLogFile[AppendOnlyEventLogJSONL]
  replayTool[ReplayCLI]
  mapboxApi[MapboxAPI]
  resendApi[ResendAPI]

  webClient -->|"REST JWT"| fastapiApp
  fastapiApp -->|"ORM read write"| sqliteDb
  fastapiApp -->|"append write events"| eventLogFile
  replayTool -->|"rebuild state from events"| sqliteDb
  replayTool -->|"read stream"| eventLogFile
  fastapiApp -->|"maps integration"| mapboxApi
  fastapiApp -->|"email integration"| resendApi
```

## C3 — Backend Component Diagram

```mermaid
flowchart LR
  apiLayer[APILayer]
  authComponent[AuthComponent]
  policyEngine[PolicyEngineComponent]
  bookingEngine[BookingEngineComponent]
  courtService[CourtServiceComponent]
  userCabinetService[UserCabinetServiceComponent]
  dashboardService[DashboardServiceComponent]
  piiCrypto[PIICryptoComponent]
  keyringComponent[KeyringComponent]
  eventLogService[EventLogServiceComponent]
  persistenceRepo[SQLAlchemyRepositories]
  sqliteDb[SQLiteDatabase]
  eventLogFile[EventLogJSONL]

  apiLayer --> authComponent
  apiLayer --> policyEngine
  apiLayer --> bookingEngine
  apiLayer --> courtService
  apiLayer --> userCabinetService
  apiLayer --> dashboardService

  bookingEngine --> policyEngine
  courtService --> policyEngine
  userCabinetService --> piiCrypto
  dashboardService --> policyEngine

  piiCrypto --> keyringComponent
  bookingEngine --> eventLogService
  courtService --> eventLogService
  dashboardService --> eventLogService
  userCabinetService --> eventLogService

  authComponent --> persistenceRepo
  bookingEngine --> persistenceRepo
  courtService --> persistenceRepo
  dashboardService --> persistenceRepo
  userCabinetService --> persistenceRepo

  persistenceRepo --> sqliteDb
  eventLogService --> eventLogFile
```

## C3 — Frontend Component Diagram

```mermaid
flowchart TB
  appShell[AppShell]
  authModule[AuthModule]
  searchModule[SearchAndMapModule]
  courtDetailModule[CourtDetailModule]
  calendarModule[DayWeekCalendarModule]
  bookingModule[BookingModule]
  cabinetModule[UserCabinetModule]
  dashboardModule[ModeratorAdminDashboardModule]
  rbacUiGuard[RbacUiGuard]
  apiClient[ApiClient]

  appShell --> authModule
  appShell --> searchModule
  appShell --> courtDetailModule
  appShell --> calendarModule
  appShell --> bookingModule
  appShell --> cabinetModule
  appShell --> dashboardModule

  dashboardModule --> rbacUiGuard
  cabinetModule --> rbacUiGuard
  bookingModule --> apiClient
  calendarModule --> apiClient
  searchModule --> apiClient
  dashboardModule --> apiClient
  cabinetModule --> apiClient
  authModule --> apiClient
```

## C4 — Booking Hold and Confirm Sequence

```mermaid
sequenceDiagram
  participant userClient as UserClient
  participant api as FastAPI
  participant policy as PolicyEngine
  participant booking as BookingEngine
  participant db as SQLiteDB
  participant log as EventLogJSONL

  userClient->>api: POST /api/bookings/hold
  api->>policy: evaluate bookings:hold
  policy-->>api: allow
  api->>booking: createHold(courtId slotStarts userId)
  booking->>db: check free slots
  booking->>db: insert slot_holds with heldUntil
  booking->>log: append hold_created
  booking-->>api: holdToken heldUntil
  api-->>userClient: 201 hold response

  userClient->>api: POST /api/bookings/confirm
  api->>policy: evaluate bookings:confirm
  policy-->>api: allow
  api->>booking: confirmHold(holdToken)
  booking->>db: validate hold not expired
  booking->>db: create booking and mark slots booked
  booking->>log: append booking_confirmed
  booking-->>api: booking details
  api-->>userClient: 201 booking confirmed
```

## C4 — Authorization Decision Flow

```mermaid
flowchart TD
  requestNode[IncomingRequest]
  authNode[AuthenticateJWT]
  permissionNode[ResolveRolePermissions]
  policyNode[EvaluatePolicies]
  ownershipNode[EvaluateOwnershipRule]
  denyCheckNode{AnyExplicitDeny}
  allowCheckNode{AnyAllow}
  executeNode[ExecuteEndpointHandler]
  forbiddenNode[Return403]
  auditNode[AppendAuthorizationAuditEvent]

  requestNode --> authNode
  authNode --> permissionNode
  permissionNode --> policyNode
  policyNode --> ownershipNode
  ownershipNode --> denyCheckNode
  denyCheckNode -->|yes| forbiddenNode
  denyCheckNode -->|no| allowCheckNode
  allowCheckNode -->|yes| executeNode
  allowCheckNode -->|no| forbiddenNode
  executeNode --> auditNode
  forbiddenNode --> auditNode
```

## C4 — PII Encryption and Key Rotation

```mermaid
flowchart LR
  piiInput[PIIPlaintextInput]
  dataEncrypt[GenerateDEKAndEncryptPayload]
  kekEncrypt[EncryptDEKWithKEKVersion]
  dbStore[StoreCiphertextNonceEncryptedDEKKeyVersion]
  readPath[ReadCipherRecord]
  keyResolver[ResolveKEKByKeyVersion]
  decryptPath[DecryptDEKThenPayload]
  rotationJob[RotationJob]
  reencrypt[ReEncryptWithNewActiveKEK]

  piiInput --> dataEncrypt
  dataEncrypt --> kekEncrypt
  kekEncrypt --> dbStore

  dbStore --> readPath
  readPath --> keyResolver
  keyResolver --> decryptPath

  rotationJob --> readPath
  rotationJob --> reencrypt
  reencrypt --> dbStore
```

## C4 — Event Log Replay Recovery

```mermaid
flowchart TD
  replayStart[ReplayStart]
  readEvents[ReadEventLogJSONL]
  verifyChain[VerifyHashChainIntegrity]
  decryptPayload[DecryptEventPayloadByKeyVersion]
  applyMutation[ApplyMutationToEmptyDatabase]
  nextEvent{MoreEvents}
  replayDone[ReplayCompleted]

  replayStart --> readEvents
  readEvents --> verifyChain
  verifyChain --> decryptPayload
  decryptPayload --> applyMutation
  applyMutation --> nextEvent
  nextEvent -->|yes| verifyChain
  nextEvent -->|no| replayDone
```

