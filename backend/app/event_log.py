import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.config import get_settings


class EventLogger:
    def __init__(self) -> None:
        settings = get_settings()
        self.path: Path = settings.event_log_path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.path.write_text("", encoding="utf-8")

    def _last_hash(self) -> str:
        lines = self.path.read_text(encoding="utf-8").splitlines()
        if not lines:
            return "GENESIS"
        last_event = json.loads(lines[-1])
        return last_event["hash"]

    def append(self, event_type: str, actor_id: int | None, payload: dict[str, Any]) -> dict[str, Any]:
        event = {
            "event_id": str(uuid4()),
            "event_type": event_type,
            "actor_id": actor_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "payload": payload,
            "prev_hash": self._last_hash(),
        }
        digest = hashlib.sha256(
            (event["prev_hash"] + json.dumps(event, separators=(",", ":"), sort_keys=True)).encode("utf-8")
        ).hexdigest()
        event["hash"] = digest

        with self.path.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(event, ensure_ascii=True) + "\n")
        return event

    def verify_chain(self) -> tuple[bool, int]:
        count = 0
        prev_hash = "GENESIS"
        with self.path.open("r", encoding="utf-8") as stream:
            for line in stream:
                if not line.strip():
                    continue
                event = json.loads(line)
                if event["prev_hash"] != prev_hash:
                    return False, count
                expected = hashlib.sha256(
                    (event["prev_hash"] + json.dumps({k: v for k, v in event.items() if k != "hash"}, separators=(",", ":"), sort_keys=True)).encode("utf-8")
                ).hexdigest()
                if event["hash"] != expected:
                    return False, count
                prev_hash = event["hash"]
                count += 1
        return True, count

