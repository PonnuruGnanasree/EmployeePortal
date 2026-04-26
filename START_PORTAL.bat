@echo off
title Gantec Portal Server
echo --------------------------------------------------
echo   🚀 STARTING GANTEC EMPLOYEE PORTAL
echo --------------------------------------------------
echo.
cd /d "%~dp0"

:: Check if node_modules exists
if not exist "node_modules\" (
    echo [1/2] Installing dependencies (this may take a minute)...
    call npm install
) else (
    echo [1/2] Dependencies already installed.
)

echo [2/2] Starting server...
echo.
npm start
pause
