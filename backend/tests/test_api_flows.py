from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app

def _auth_headers(client: TestClient) -> dict[str, str]:
    login = client.post(
        "/api/auth/login",
        json={"email": "superuser@courtly.example.com", "password": "ChangeMeNow123!"},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


def test_seeded_courts_and_availability_support_ui() -> None:
    with TestClient(app) as client:
        courts = client.get("/api/courts")
        assert courts.status_code == 200
        body = courts.json()
        assert len(body) >= 3

        availability = client.get(f"/api/courts/{body[0]['id']}/availability")
        assert availability.status_code == 200
        assert availability.json()[0]["state"] in {"free", "held", "booked", "disabled", "past"}
        assert any(slot["state"] == "disabled" for slot in availability.json())


def test_public_register_creates_user_and_tokens() -> None:
    unique = uuid4().hex[:8]
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/register",
            json={
                "first_name": "Vasya",
                "last_name": "Pupkin",
                "email": f"vasya-{unique}@courtly.example.com",
                "password": "ChangeMeNow123!",
            },
        )
        assert response.status_code == 201, response.text
        assert response.json()["access_token"]

        token = response.json()["access_token"]
        profile = client.get("/api/me/profile", headers={"Authorization": f"Bearer {token}"})
        assert profile.status_code == 200, profile.text
        assert profile.json()["full_name"] == "Pupkin Vasya"


def test_core_flow_create_court_hold_confirm_cancel() -> None:
    with TestClient(app) as client:
        headers = _auth_headers(client)
        create_court = client.post(
            "/api/courts",
            headers=headers,
            json={
                "name": "Center Court",
                "city": "Kyiv",
                "district": "Pechersk",
                "address": "Main Street 1",
                "surface": "clay",
                "price_per_hour": 800,
                "opening_time": "00:00",
                "closing_time": "23:59"
            },
        )
        assert create_court.status_code == 201, create_court.text
        court_id = create_court.json()["id"]

        base = datetime.now(timezone.utc) + timedelta(hours=2)
        base = base.replace(minute=(base.minute // 30) * 30, second=0, microsecond=0)
        slots = [base.isoformat(), (base + timedelta(minutes=30)).isoformat()]
        hold = client.post("/api/bookings/hold", headers=headers, json={"court_id": court_id, "slot_starts": slots})
        assert hold.status_code == 201, hold.text
        hold_token = hold.json()["hold_token"]

        confirm = client.post("/api/bookings/confirm", headers=headers, json={"hold_token": hold_token})
        assert confirm.status_code == 200, confirm.text
        booking_id = confirm.json()["id"]
        assert confirm.json()["status"] == "confirmed"

        cancel = client.post(f"/api/bookings/{booking_id}/cancel", headers=headers, json={"reason": "Cannot attend"})
        assert cancel.status_code == 200, cancel.text
        assert cancel.json()["status"] == "cancelled"

        detail = client.get(f"/api/me/bookings/{booking_id}", headers=headers)
        assert detail.status_code == 200, detail.text
        assert detail.json()["court_name"] == "Center Court"

        review = client.post(
            "/api/me/reviews",
            headers=headers,
            json={"booking_id": booking_id, "court_id": court_id, "rating": 5, "comment": "Great court"},
        )
        assert review.status_code == 201, review.text
        duplicate_review = client.post(
            "/api/me/reviews",
            headers=headers,
            json={"booking_id": booking_id, "court_id": court_id, "rating": 4, "comment": "Duplicate"},
        )
        assert duplicate_review.status_code == 409, duplicate_review.text

        moderator_message = client.post(
            "/api/me/moderator-message",
            headers=headers,
            json={
                "booking_id": booking_id,
                "court_id": court_id,
                "subject": "Question",
                "message": "Please confirm lights are available.",
            },
        )
        assert moderator_message.status_code == 200, moderator_message.text


def test_admin_dashboard_crud_endpoints_support_ui() -> None:
    unique = uuid4().hex[:8]
    with TestClient(app) as client:
        headers = _auth_headers(client)

        users = client.get("/api/admin/users", headers=headers)
        roles = client.get("/api/admin/roles", headers=headers)
        policies = client.get("/api/admin/policies", headers=headers)
        bookings = client.get("/api/admin/bookings", headers=headers)
        assert users.status_code == 200
        assert roles.status_code == 200
        assert policies.status_code == 200
        assert bookings.status_code == 200

        created_user = client.post(
            "/api/admin/users",
            headers=headers,
            json={
                "email": f"manager-{unique}@courtly.example.com",
                "full_name": "Dashboard Manager",
                "password": "ChangeMeNow123!",
                "role": "user",
            },
        )
        assert created_user.status_code == 201, created_user.text
        user_id = created_user.json()["id"]

        updated_user = client.patch(f"/api/admin/users/{user_id}", headers=headers, json={"role": "moderator"})
        assert updated_user.status_code == 200, updated_user.text
        assert updated_user.json()["role"] == "moderator"

        created_role = client.post("/api/admin/roles", headers=headers, json={"name": f"ops_{unique}"})
        assert created_role.status_code == 201, created_role.text
        role_id = created_role.json()["id"]

        created_policy = client.post(
            "/api/admin/policies",
            headers=headers,
            json={"role": "admin", "resource": "/courts", "action": f"tune_{unique}", "effect": "allow", "condition": ""},
        )
        assert created_policy.status_code == 201, created_policy.text
        policy_id = created_policy.json()["id"]

        updated_policy = client.patch(
            f"/api/admin/policies/{policy_id}",
            headers=headers,
            json={"role": "admin", "resource": "/courts", "action": f"tune_{unique}", "effect": "deny", "condition": "maintenance"},
        )
        assert updated_policy.status_code == 200, updated_policy.text
        assert updated_policy.json()["effect"] == "deny"

        created_court = client.post(
            "/api/courts",
            headers=headers,
            json={
                "name": f"Admin Court {unique}",
                "city": "Kyiv",
                "district": "Pechersk",
                "address": "Dashboard 1",
                "surface": "Hard",
                "price_per_hour": 777,
                "opening_time": "09:00",
                "closing_time": "20:00",
            },
        )
        assert created_court.status_code == 201, created_court.text
        court_id = created_court.json()["id"]

        updated_court = client.patch(
            f"/api/courts/{court_id}",
            headers=headers,
            json={"price_per_hour": 888, "opening_time": "08:00", "closing_time": "21:00"},
        )
        assert updated_court.status_code == 200, updated_court.text
        assert updated_court.json()["price_per_hour"] == 888
        assert updated_court.json()["opening_time"] == "08:00"

        assert client.delete(f"/api/courts/{court_id}", headers=headers).status_code == 200
        assert client.delete(f"/api/admin/policies/{policy_id}", headers=headers).status_code == 200
        assert client.delete(f"/api/admin/roles/{role_id}", headers=headers).status_code == 200
        assert client.delete(f"/api/admin/users/{user_id}", headers=headers).status_code == 200
