from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # App
    app_name: str = "HSIL"
    debug: bool = False

    # Auth
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Database
    database_url: str = f"sqlite+aiosqlite:///{Path(__file__).resolve().parent.parent.parent / 'data' / 'hsil.db'}"

    # Storage
    upload_dir: str = str(Path(__file__).resolve().parent.parent.parent / "data" / "images")

    # Vision API
    openai_api_key: str = ""

    # Accuracy
    accuracy_threshold: float = 0.75
    min_annotators_for_consensus: int = 3
    consensus_agreement_threshold: float = 0.7

    # CORS — comma-separated origins allowed in production
    cors_origins: str = "http://localhost:5173"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
