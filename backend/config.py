"""Backend configuration, loaded from environment / .env (TRD §12).

Cognee credentials are optional: when absent, the Cognee service wrapper runs
in a graceful local-simulation mode so the product still works end to end.
"""
from __future__ import annotations

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Secrets pasted into dashboards / .env files often pick up a trailing
    # newline, which then poisons HTTP headers ("Illegal header value b'…\n'").
    @field_validator("*", mode="before")
    @classmethod
    def _strip_whitespace(cls, v):
        return v.strip() if isinstance(v, str) else v

    app_env: str = "development"
    database_url: str = "sqlite:///./sentinelgraph.db"

    # Admin API key — gates state-mutating admin/memory routes. When empty, auth
    # is enforced (fail-closed) in production and skipped in development so the
    # local demo keeps working. Provide via env in prod.
    admin_api_key: str = ""

    # Per-client rate limit for public write endpoints (/scan, /report).
    rate_limit: str = "20/minute"

    # CORS — the Next.js web frontend origin(s).
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Cognee. dataset name per TRD §9. Credentials provided later; the wrapper
    # degrades gracefully until then.
    cognee_dataset: str = "global-threat-intel"
    cognee_base_url: str = ""      # e.g. https://tenant-xxx.aws.cognee.ai
    cognee_api_key: str = ""
    openai_api_key: str = ""       # only needed for Cognee local SDK mode

    @property
    def cognee_enabled(self) -> bool:
        return bool(self.cognee_base_url and self.cognee_api_key)

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"production", "prod"}

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
