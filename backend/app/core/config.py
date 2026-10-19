from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Distributed Inventory & Warehouse Management System"
    database_url: str = "postgresql+psycopg2://inventory_user:inventory_password@localhost:5432/inventory_db"
    jwt_secret: str = Field(default="dev-only-change-this-secret-at-least-32-chars")
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 480
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]


settings = Settings()
