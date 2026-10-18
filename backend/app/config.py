import os
from typing import Optional
from pydantic import model_validator
from pydantic_settings import BaseSettings

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ROOT_DIR = os.path.dirname(_BACKEND_DIR)
_BACKEND_ENV = os.path.join(_BACKEND_DIR, ".env")
_ROOT_ENV = os.path.join(_ROOT_DIR, ".env")


class Settings(BaseSettings):
    DATABASE_URL: Optional[str] = None

    # Supabase / PostgreSQL Direct Connection Parameters
    DB_HOST: Optional[str] = None
    DB_PORT: int = 6543
    DB_NAME: str = "postgres"
    DB_USER: Optional[str] = None
    DB_PASSWORD: Optional[str] = None
    DB_SSLMODE: str = "require"

    # Supabase API & Project Configuration
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    ML_SERVICE_URL: str = "http://localhost:8001"

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_FROM_NAME: str = "Maharashtra Traffic E-Challan"

    # SMS Gateway (Fast2SMS / Twilio)
    FAST2SMS_API_KEY: str = ""
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    EVIDENCE_STORAGE_PATH: str = "./storage/evidence"
    RECEIPT_STORAGE_PATH: str = "./storage/receipts"

    FRONTEND_URL: str = "http://localhost:5173"
    ENV: str = "development"

    @model_validator(mode="after")
    def assemble_database_url(self) -> "Settings":
        if not self.DATABASE_URL:
            if self.DB_HOST and self.DB_USER and self.DB_PASSWORD:
                self.DATABASE_URL = (
                    f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?sslmode={self.DB_SSLMODE}"
                )
            else:
                raise ValueError("Neither DATABASE_URL nor DB_HOST/DB_USER/DB_PASSWORD configured for Supabase database.")

        # Fallback resolution for SMTP credentials to avoid empty string overrides
        if not (self.SMTP_USER and self.SMTP_USER.strip()) or not (self.SMTP_PASSWORD and self.SMTP_PASSWORD.strip()):
            try:
                from dotenv import dotenv_values
                for env_p in (_BACKEND_ENV, _ROOT_ENV):
                    if os.path.exists(env_p):
                        vals = dotenv_values(env_p)
                        if not (self.SMTP_USER and self.SMTP_USER.strip()) and vals.get("SMTP_USER"):
                            self.SMTP_USER = vals.get("SMTP_USER", "").strip()
                        if not (self.SMTP_PASSWORD and self.SMTP_PASSWORD.strip()) and vals.get("SMTP_PASSWORD"):
                            self.SMTP_PASSWORD = vals.get("SMTP_PASSWORD", "").strip()
            except Exception:
                pass

        if not self.SMTP_FROM:
            self.SMTP_FROM = self.SMTP_USER

        return self

    class Config:
        env_file = (_ROOT_ENV, _BACKEND_ENV, ".env")
        extra = "ignore"


settings = Settings()

