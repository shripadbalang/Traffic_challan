# API Contracts & Interface Documentation

## Overview

The Traffic E-Challan platform consists of two services exposing HTTP APIs:
1. **Backend Service** (`http://localhost:8000`)
2. **ML Inference Service** (`http://localhost:8001`)

Interactive OpenAPI / Swagger documentation is available locally at:
- Backend: `http://localhost:8000/docs`
- ML Service: `http://localhost:8001/docs`

---

## 1. ML Microservice API (`:8001`)

### Detect Violations & Recognize Plates

- **Endpoint**: `POST /detect`
- **Content-Type**: `multipart/form-data`
- **Request Parameters**:
  - `file`: Image file (`image/jpeg`, `image/png`) or video file (`video/mp4`)

#### Response (`200 OK`)
```json
{
  "violations_found": ["no_helmet", "triple_riding"],
  "plate_number": "MH12AB1234",
  "plate_confidence": 0.88,
  "boxes": [
    {
      "class_name": "no_helmet",
      "confidence": 0.91,
      "bbox": [120, 45, 260, 210]
    },
    {
      "class_name": "triple_riding",
      "confidence": 0.85,
      "bbox": [80, 40, 320, 300]
    },
    {
      "class_name": "license_plate",
      "confidence": 0.94,
      "bbox": [210, 310, 290, 340]
    }
  ],
  "annotated_file_path": null
}
```

---

## 2. Core Backend Service API (`:8000`)

### Authentication (`/auth`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/auth/login` | Officer / Admin login with email & password | None |
| `POST` | `/auth/citizen/signup` | Register citizen with name, phone, plate number | None |
| `POST` | `/auth/otp/request` | Request 6-digit login OTP for mobile number | None |
| `POST` | `/auth/otp/verify` | Verify OTP and obtain JWT bearer access token | None |

### Violations & AI Detection (`/violations`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/violations/detect` | Upload evidence photo/video; calls ML service and creates challan | Officer / Admin |
| `GET` | `/violations/types` | List violation types and standard statutory fines | Any authenticated user |

### Challans (`/challans`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/challans/manual` | Officer manually issues a challan with plate & location | Officer / Admin |
| `GET` | `/challans/my` | Citizen queries their active and paid challans | Citizen |
| `GET` | `/challans/{id}` | Retrieve single challan details | Authenticated owner or officer |
| `GET` | `/challans/{id}/receipt` | Download generated PDF receipt | Authenticated owner or officer |

### Payments (`/payments`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/payments/initiate` | Create Razorpay order for an unpaid challan | Citizen |
| `POST` | `/payments/verify` | Verify Razorpay payment signature & issue receipt | Citizen |

### Vehicles (`/vehicles`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/vehicles/my` | List vehicles owned by logged-in citizen | Citizen |
| `POST` | `/vehicles/register` | Register a new vehicle to citizen profile | Citizen |

### Admin & Analytics (`/admin`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/admin/dashboard` | Aggregated analytics (total fines, collection %, violation breakdown) | Admin |
