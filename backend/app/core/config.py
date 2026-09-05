from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # AI
    gemini_api_key: str = ""

    # Razorpay
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

    # App
    database_url: str = "sqlite+aiosqlite:///./recovery_os.db"
    environment: str = "development"
    log_level: str = "INFO"

    # Server
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    # Frontend
    vite_api_base_url: str = "http://localhost:8000"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
