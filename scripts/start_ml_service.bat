@echo off
title ML Inference Service (:8001)
echo Starting ML Inference Service on http://localhost:8001...
cd /d "%~dp0..\ml-service"
call venv\Scripts\activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001
pause
