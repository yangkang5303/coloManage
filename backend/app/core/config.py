from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./colo_mvp.db"
    secret_key: str = "dev-secret"
    access_token_expire_minutes: int = 720
    storage_dir: str = "./storage"
    backend_cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    llm_base_url: str = "http://internal-llm.company.local/v1"
    llm_api_key: str = "changeme"
    llm_small_model: str = "internal-9b"
    llm_medium_model: str = "internal-14b"
    llm_timeout_seconds: int = 120

    # Embedding settings
    embedding_model: str = "BAAI/bge-m3"
    embedding_dim: int = 1024
    embedding_enabled: bool = True

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [item.strip() for item in self.backend_cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
