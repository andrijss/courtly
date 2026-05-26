from fastapi import APIRouter

from app.routers import admin, auth, bookings, courts, dashboard, me


def api_router() -> APIRouter:
    router = APIRouter()
    router.include_router(auth.router, tags=["Auth"])
    router.include_router(courts.router, tags=["Courts", "Availability"])
    router.include_router(bookings.router, tags=["Bookings"])
    router.include_router(me.router, tags=["Cabinet"])
    router.include_router(dashboard.router, tags=["Dashboard"])
    router.include_router(admin.router, tags=["RBAC", "EventLog"])
    return router

