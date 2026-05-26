from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.event_log import EventLogger
from app.replay import replay_events


def main() -> None:
    event_logger = EventLogger()
    ok, verified = event_logger.verify_chain()
    if not ok:
        raise SystemExit("Event log verification failed")
    with SessionLocal() as db:  # type: Session
        replayed = replay_events(event_logger.path, db)
    print(f"verified_events={verified} replayed_events={replayed}")


if __name__ == "__main__":
    main()

