from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    ML_SERVICE_URL: str = "http://localhost:8001"

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = "Maharashtra Traffic E-Challan"

    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    EVIDENCE_STORAGE_PATH: str = "./storage/evidence"
    RECEIPT_STORAGE_PATH: str = "./storage/receipts"

    FRONTEND_URL: str = "http://localhost:5173"
    ENV: str = "development"

    class Config:
        env_file = ".env"


settings = Settings()
