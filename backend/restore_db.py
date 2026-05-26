import argparse
from pathlib import Path

from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.event_log import EventLogger
from app.main import _ensure_schema, _seed_rbac_policies
from app.replay import replay_events


def _sqlite_path() -> Path | None:
    url = str(engine.url)
    if not url.startswith("sqlite:///"):
        return None
    raw = url.removeprefix("sqlite:///")
    return Path(raw)


def restore_db(force: bool) -> int:
    event_logger = EventLogger()
    ok, verified_events = event_logger.verify_chain()
    if not ok:
        raise SystemExit("Event log verification failed. Refusing to restore database.")

    db_path = _sqlite_path()
    if db_path is not None and db_path.exists():
        if not force:
            raise SystemExit(
                f"Database file already exists at {db_path}. Use --force to recreate it from event log."
            )
        db_path.unlink()

    Base.metadata.create_all(bind=engine)
    _ensure_schema()

    with SessionLocal() as db:  # type: Session
        _seed_rbac_policies(db)
        db.commit()
        replayed_events = replay_events(event_logger.path, db)

    print(
        "restore_complete"
        f" verified_events={verified_events}"
        f" replayed_events={replayed_events}"
        f" db_path={db_path if db_path is not None else engine.url}"
    )
    return replayed_events


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Restore the backend database from event_log.jsonl."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Delete existing SQLite DB file before restore.",
    )
    return parser


def main() -> None:
    args = _build_parser().parse_args()
    restore_db(force=args.force)


if __name__ == "__main__":
    main()
