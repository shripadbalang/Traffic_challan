# Traffic E-Challan — Backend (FastAPI)

## Setup

1. **Create a Supabase project** (free tier) at supabase.com. Copy the Postgres connection
   string from Project Settings → Database → Connection string (URI).

2. **Copy env file and fill in values:**
   ```bash
   cp .env.example .env
   # edit .env: DATABASE_URL, JWT_SECRET, SMTP creds, RAZORPAY test keys, ML_SERVICE_URL
   ```

3. **Apply the schema** — open the Supabase SQL editor and run `db/schema.sql`
   (or `psql $DATABASE_URL -f db/schema.sql` if you have psql installed).

4. **Install dependencies:**
   ```bash
   python -m venv venv
   source venv/bin/activate   # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

5. **Seed demo database (citizens, vehicles, officers, admin, challans):**
   ```bash
   python -m scripts.seed_demo_data
   ```
   *To customize demo people or vehicles*:
   - Edit `scripts/demo_data.json` directly to put in your own names, mobile numbers, and vehicle plates.
   - Or run interactively: `python -m scripts.seed_demo_data --add-citizen`
   - To reset cleanly: `python -m scripts.seed_demo_data --clean`

6. **Run the server:**
   ```bash
   uvicorn app.main:app --reload
   ```
   API docs available at http://localhost:8000/docs

## Connecting your trained models (ml-service)

This backend does NOT run YOLO inference directly — it calls a separate ML
microservice (see `app/services/ml_client.py`) over HTTP at `ML_SERVICE_URL`.

Your ml-service needs a single endpoint:

```
POST /detect
  multipart/form-data, field "file" = image or video

  Response:
  {
    "violations_found": ["no_helmet", "triple_riding"],
    "plate_number": "MH12AB1234",
    "plate_confidence": 0.91,
    "boxes": [
      {"class_name": "no_helmet", "confidence": 0.87, "bbox": [120, 45, 260, 210]}
    ],
    "annotated_file_path": null
  }
```

Once you send over your trained `.pt` weights, I'll build this `ml-service`
as its own FastAPI app that loads your YOLO models and implements this
exact contract — nothing in the backend needs to change.

## Docker

```bash
docker build -t echallan-backend .
docker run -p 8000:8000 --env-file .env echallan-backend
```

(Full `docker-compose.yml` wiring backend + ml-service + frontend comes once
the other pieces are built.)

## Quick smoke test flow

1. `POST /auth/citizen/signup` with a plate number that exists in `db/schema.sql` seed data
   (e.g. `MH12AB1234`)
2. `POST /auth/otp/request` → note the `debug_otp` in the response (simulated SMS)
3. `POST /auth/otp/verify` → returns JWT access token
4. Use the officer account (`officer1@echallan.gov.in` / `Officer@123`) to
   `POST /challans/manual` against the same plate number
5. `GET /challans/my` (as citizen) → see the challan
6. `POST /payments/initiate` → `POST /payments/verify` → receipt PDF + QR generated
