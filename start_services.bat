@echo off
title Traffic E-Challan Services Launcher
echo ========================================================
echo Starting Traffic E-Challan Services
echo ========================================================
echo 1. Launching ML Inference Service (Port 8001)...
start "ML Service (:8001)" cmd /c "cd /d "%~dp0ml-service" && venv\Scripts\activate && python -m uvicorn app.main:app --host 0.0.0.0 --port 8001"
timeout /t 3 /nobreak >nul

echo 2. Launching Backend API (Port 8000)...
start "Backend API (:8000)" cmd /c "cd /d "%~dp0backend" && venv\Scripts\activate && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 2 /nobreak >nul

echo 3. Launching Frontend (:5173)...
start "Frontend (:5173)" cmd /c "cd /d "%~dp0frontend" && npm run dev"

echo ========================================================
echo All services launched in separate windows!
echo - ML Service: http://localhost:8001 (Health: /health)
echo - Backend API: http://localhost:8000 (Docs: /docs)
echo - Frontend:    http://localhost:5173
echo ========================================================
