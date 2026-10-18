import os

from app.config import settings


_model_cache = {}


def _load(name: str, path: str):
    """
    Load a YOLO model from disk.

    Models are cached in memory so they are loaded only once.
    """

    if name in _model_cache:
        return _model_cache[name]

    if not os.path.exists(path):
        app_dir = os.path.dirname(os.path.abspath(__file__))
        ml_service_dir = os.path.dirname(app_dir)
        alt_path = os.path.join(ml_service_dir, path.lstrip("./\\"))
        if os.path.exists(alt_path):
            path = alt_path
        else:
            print(
                f"[ml-service] WARNING: model file not found "
                f"for '{name}' at '{path}' (also checked '{alt_path}')"
            )
            _model_cache[name] = None
            return None

    from ultralytics import YOLO

    print(
        f"[ml-service] Loading model '{name}' "
        f"from {path} ..."
    )

    model = YOLO(path)

    _model_cache[name] = model

    print(
        f"[ml-service] Loaded '{name}'. "
        f"Classes: {model.names}"
    )

    return model


def get_general_model():
    """
    General YOLO11n model.

    Used for detecting:
        - person
        - motorcycle

    This model is used to calculate triple riding
    instead of relying on the specialized triple-riding model.
    """

    # The model was downloaded to:
    # D:\workspace\Traffic_challan\ml-service\yolo11n.pt
    #
    # Use config value if it exists.
    # Otherwise fall back to yolo11n.pt.

    model_path = getattr(
        settings,
        "GENERAL_MODEL_PATH",
        "./yolo11n.pt"
    )

    return _load(
        "general",
        model_path
    )


def get_helmet_model():
    """
    Load the helmet violation model.
    """

    return _load(
        "helmet",
        settings.HELMET_MODEL_PATH
    )


def get_wrong_side_model():
    """
    Load the wrong-side violation model.
    """

    return _load(
        "wrong_side",
        settings.WRONG_SIDE_MODEL_PATH
    )


def get_triple_riding_model():
    """
    Load the old specialized triple-riding model.

    Kept temporarily for compatibility/testing.
    The new detection pipeline will derive triple riding
    from person + motorcycle detection.
    """

    return _load(
        "triple_riding",
        settings.TRIPLE_RIDING_MODEL_PATH
    )


def get_plate_model():
    """
    Load the number-plate detection model.
    """

    return _load(
        "plate",
        settings.PLATE_MODEL_PATH
    )


def get_pose_model():
    """
    Load YOLO11 Pose estimation model for rider orientation/heading analysis.
    """
    model_path = getattr(
        settings,
        "POSE_MODEL_PATH",
        "./models/yolo11n-pose.pt"
    )
    return _load(
        "pose",
        model_path
    )


def preload_all():
    """
    Load all models when the ML service starts.

    This prevents the first API request from having
    to wait for model loading.
    """

    print("[ml-service] Preloading models...")

    get_general_model()
    get_pose_model()
    get_helmet_model()
    get_wrong_side_model()
    get_plate_model()

    print("[ml-service] Model preloading complete.")