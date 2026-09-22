from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    GENERAL_MODEL_PATH: str = "./yolo11n.pt"

    HELMET_MODEL_PATH: str = "./models/helmet_best.pt"

    WRONG_SIDE_MODEL_PATH: str = "./models/wrong_side_best.pt"

    TRIPLE_RIDING_MODEL_PATH: str = "./models/triple_riding_best.pt"

    PLATE_MODEL_PATH: str = "./models/numberplate_best.pt"

    HELMET_VIOLATION_CLASS_NAME: str = "without helmet"

    WRONG_SIDE_VIOLATION_CLASS_NAME: str = "wrong-side"

    TRIPLE_RIDING_VIOLATION_CLASS_NAME: str = "tripleriding"

    PLATE_CLASS_NAME: str = "0"

    CONFIDENCE_THRESHOLD: float = 0.40

    PLATE_CONFIDENCE_THRESHOLD: float = 0.50

    PERSON_CLASS_ID: int = 0

    MOTORCYCLE_CLASS_ID: int = 3

    TRIPLE_RIDING_PERSON_IOU_THRESHOLD: float = 0.08

    TRIPLE_RIDING_MIN_PEOPLE: int = 3

    VIDEO_FRAME_SAMPLE_RATE: int = 15

    class Config:
        env_file = ".env"


settings = Settings()