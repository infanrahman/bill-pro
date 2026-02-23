@echo off
cd /d "%~dp0"
echo Starting Billing App...
call npx electron .
if %ERRORLEVEL% NEQ 0 (
    echo Failed to start the application.
    pause
)
