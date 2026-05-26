from fastapi.testclient import TestClient

from app.event_log import EventLogger
from app.main import app


def _auth_headers(client: TestClient) -> dict[str, str]:
    login = client.post(
        "/api/auth/login",
        json={"email": "superuser@courtly.example.com", "password": "ChangeMeNow123!"},
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_event_log_chain_and_replay_endpoint() -> None:
    logger = EventLogger()
    logger.append("test.event", 1, {"probe": "ok"})
    ok, count = logger.verify_chain()
    assert ok is True
    assert count >= 1

    with TestClient(app) as client:
        headers = _auth_headers(client)
        response = client.post("/api/admin/event-log/replay", headers=headers)
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["ok"] is True
        assert body["events_replayed"] >= 1

