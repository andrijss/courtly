# Courtly Implementation

This repository now includes a full-stack baseline implementation derived from `docs/`:

- Backend: FastAPI + SQLAlchemy + SQLite + JWT auth + Argon2id + PII encryption + event log.
- Frontend: React + Vite test UI for auth/discovery/booking/cabinet flows.
- Tests: API integration tests for health and core booking lifecycle.

## Structure

- `backend/app/main.py` - API bootstrap and startup seed.
- `backend/app/routers/` - endpoint groups (`auth`, `courts`, `bookings`, `me`, `dashboard`, `admin`).
- `backend/app/models.py` - core data model (`users`, `courts`, `bookings`, `rbac`, etc.).
- `backend/app/event_log.py` - append-only JSONL hash-chain event log.
- `backend/replay_cli.py` - replay command-line utility.
- `backend/restore_db.py` - restore `courtly.db` from `event_log.jsonl`.
- `frontend/src/` - minimal UI and API client.

## Backend Run

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Default seeded superuser:

- email: `superuser@courtly.example.com`
- password: `ChangeMeNow123!`

## Frontend Run

```bash
cd frontend
npm install
npm run dev
```

Optional API base override:

```bash
VITE_API_BASE=http://localhost:8000/api npm run dev
```

## Tests

```bash
cd backend
pytest
```

## Replay CLI

```bash
cd backend
python replay_cli.py
```

## DB Restore from Event Log

```bash
cd backend
python restore_db.py --force
```

Use this after deleting `courtly.db` (or with `--force` to recreate it). The script verifies the event-log hash chain, recreates schema/default seed data, and replays events.
