# Frontend — Traffic E-Challan Web Portal

This directory is reserved for the frontend web application (Citizen Portal & Police/Admin Dashboard).

## Recommended Stack
- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Icons**: [lucide-react](https://lucide.dev/)
- **State & Query**: [TanStack Query (React Query)](https://tanstack.com/query) + [Axios](https://axios-http.com/)
- **Routing**: [React Router](https://reactrouter.com/)

## Features & Modules

### 1. Citizen Portal
- **Login / Authentication**: Mobile OTP login (integrated with `POST /auth/otp/request` and `POST /auth/otp/verify`).
- **Vehicle Dashboard**: View registered vehicles (`GET /vehicles/my`) and add new vehicles.
- **My Challans**: List unpaid and paid challans (`GET /challans/my`).
- **Payment Processing**: Razorpay checkout integration (`POST /payments/initiate` & `POST /payments/verify`).
- **Receipt & Proof Download**: Download PDF payment receipts with verification QR codes (`GET /challans/{id}/receipt`).

### 2. Officer & Admin Dashboard
- **Officer Login**: Email / Password authentication (`POST /auth/login`).
- **AI Violation Review & Ingestion**:
  - Live photo/video capture and upload (`POST /violations/detect`).
  - Visual bounding box verification and OCR review.
- **Manual Challan Generation**: Issue manual challans with photo evidence (`POST /challans/manual`).
- **Administrative Analytics**:
  - System-wide statistics (`GET /admin/dashboard`).
  - Violation trends by type, officer, location, and collection rates.

## Development Setup (Once Initialized)
```bash
# Initialize a new Vite + React + TypeScript project
npm create vite@latest . -- --template react-ts
npm install
npm run dev
```

The frontend should run on port `5173` to match the default CORS and redirect configurations in `backend/app/config.py` (`FRONTEND_URL: str = "http://localhost:5173"`).
