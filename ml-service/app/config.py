from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    GENERAL_MODEL_PATH: str = "./models/yolo11n.pt"

    POSE_MODEL_PATH: str = "./models/yolo11n-pose.pt"

    HELMET_MODEL_PATH: str = "./models/helmet_best.pt"

    WRONG_SIDE_MODEL_PATH: str = "./models/wrong_side_best.pt"

    TRIPLE_RIDING_MODEL_PATH: str = "./models/triple_riding_best.pt"

    PLATE_MODEL_PATH: str = "./models/numberplate_best.pt"

    HELMET_VIOLATION_CLASS_NAME: str = "without helmet"

    WRONG_SIDE_VIOLATION_CLASS_NAME: str = "wrong-side"

    TRIPLE_RIDING_VIOLATION_CLASS_NAME: str = "tripleriding"

    PLATE_CLASS_NAME: str = "0"

    CONFIDENCE_THRESHOLD: float = 0.40

    WRONG_SIDE_CONFIDENCE_THRESHOLD: float = 0.50

    PLATE_CONFIDENCE_THRESHOLD: float = 0.25

    PERSON_CLASS_ID: int = 0

    MOTORCYCLE_CLASS_ID: int = 3

    TRIPLE_RIDING_PERSON_IOU_THRESHOLD: float = 0.08

    TRIPLE_RIDING_MIN_PEOPLE: int = 3
    TRIPLE_RIDING_CONFIDENCE_THRESHOLD: float = 0.30

    VIDEO_FRAME_SAMPLE_RATE: int = 15

    # Open-LPR Integration Settings (Disabled for fast local OCR)
    OPEN_LPR_ENABLED: bool = False
    OPEN_LPR_MODE: str = "service"  # "service" or "vlm"
    OPEN_LPR_API_URL: str = "http://open-lpr:8000/api/v1/ocr/"
    OPEN_LPR_VLM_BASE_URL: str = ""
    OPEN_LPR_VLM_API_KEY: str = ""
    OPEN_LPR_VLM_MODEL: str = "qwen2-vl-7b-instruct"
    OPEN_LPR_TIMEOUT: float = 12.0
    OPEN_LPR_FALLBACK_TO_EASYOCR: bool = True

    class Config:
        env_file = ".env"


settings = Settings()