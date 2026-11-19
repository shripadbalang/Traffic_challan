@echo off
title Ngrok Production Tunnel for Traffic E-Challan
echo ========================================================
echo Starting Ngrok Tunnel to Local Backend (Port 8000)
echo Public Endpoint: https://getting-hamburger-cradle.ngrok-free.dev
echo Production Site: https://traffic.balangshripad.dev
echo ========================================================
ngrok http 8000 --url https://getting-hamburger-cradle.ngrok-free.dev
pause
