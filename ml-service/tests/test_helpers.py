"""Test helpers for ml-service test scripts."""

import os
import sys

# Ensure ml-service root is in sys.path
ML_SERVICE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ML_SERVICE_ROOT not in sys.path:
    sys.path.insert(0, ML_SERVICE_ROOT)

SAMPLES_DIR = os.path.abspath(os.path.join(ML_SERVICE_ROOT, "..", "test-assets", "samples"))


def get_sample_path(filename: str) -> str:
    """Return the absolute path to a sample image in test-assets/samples/ or local fallback."""
    candidate = os.path.join(SAMPLES_DIR, filename)
    if os.path.exists(candidate):
        return candidate
    local_candidate = os.path.join(ML_SERVICE_ROOT, filename)
    if os.path.exists(local_candidate):
        return local_candidate
    return filename
