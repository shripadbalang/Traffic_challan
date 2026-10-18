# Test Assets & Sample Media

This directory contains shared sample media and test data used across the **Traffic E-Challan** backend integration tests, ML detection benchmarks, and OCR debugging routines.

## Directory Structure

```
test-assets/
├── samples/
│   ├── 1.jpg              # Two-wheeler rider sample (helmet violation candidate)
│   ├── 2.jpg              # Multiple riders sample (triple-riding detection candidate)
│   ├── bike_plate.jpg     # Close-up motorcycle license plate for OCR extraction
│   ├── image.jpg          # Standard traffic scene with vehicles
│   ├── images.jpg         # Street view showing multiple motorcycles and cars
│   ├── img3.jpg           # Angled two-wheeler view with visible plate
│   ├── plate_current.jpg  # Cropped high-contrast license plate sample
│   ├── test_image.jpg     # Standard benchmark image for end-to-end detection pipeline
│   └── triple_test.jpg    # Multi-person motorcycle scene for triple riding verification
└── README.md
```

## Usage

### In Backend Integration Tests:
```python
import os

SAMPLE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "test-assets", "samples")
)
test_image = os.path.join(SAMPLE_DIR, "test_image.jpg")
```

### In ML Service Tests & Debug Scripts:
```python
from pathlib import Path

SAMPLE_DIR = Path(__file__).resolve().parents[2] / "test-assets" / "samples"
image_path = SAMPLE_DIR / "bike_plate.jpg"
```
