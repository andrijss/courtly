from functools import lru_cache
from pathlib import Path
from secrets import token_bytes
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="COURTLY_")

    app_env: Literal["dev", "test", "prod"] = "dev"
    app_name: str = "Courtly API"
    api_prefix: str = "/api"

    database_url: str = "sqlite:///./courtly.db"
    event_log_path: Path = Path("./event_log.jsonl")

    jwt_secret: str = Field(default_factory=lambda: token_bytes(32).hex())
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_minutes: int = 60 * 24 * 7

    superuser_email: str = "superuser@courtly.example.com"
    superuser_password: str = "ChangeMeNow123!"

    # 32 bytes in base64 is recommended; fallback uses generated secret in dev.
    encryption_kek_b64: str = ""
    encryption_key_version: str = "v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()

