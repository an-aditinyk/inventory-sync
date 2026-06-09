"""Application configuration, read from the environment with safe local defaults."""

from __future__ import annotations

import os
from functools import lru_cache


class Settings:
    def __init__(self) -> None:
        self.database_url: str = os.getenv("DATABASE_URL", "sqlite:///./inventory_sync.db")
        # Used for JWT-ish session tokens and as the basis for the encryption key.
        # MUST be overridden in any real deployment.
        self.secret_key: str = os.getenv("SECRET_KEY", "dev-only-insecure-change-me")
        self.token_ttl_seconds: int = int(os.getenv("TOKEN_TTL_SECONDS", str(60 * 60 * 24 * 7)))
        # Comma-separated allowed CORS origins for the frontend dev server.
        self.cors_origins: list[str] = os.getenv(
            "CORS_ORIGINS", "http://localhost:5173"
        ).split(",")


@lru_cache
def get_settings() -> Settings:
    return Settings()
