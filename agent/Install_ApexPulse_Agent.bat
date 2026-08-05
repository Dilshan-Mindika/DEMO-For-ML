@echo off
TITLE ApexPulse Enterprise Client Agent - 1-Click Installer
COLOR 0A
CLS

echo ============================================================
echo   ApexPulse Enterprise Client Telemetry Agent Installer
echo   Configuring 1-Click Windows Startup Background Service...
echo ============================================================
echo.

:: 1. Check Python
python --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    COLOR 0C
    echo [!] ERROR: Python is not installed or not in system PATH.
    echo Please install Python 3.10+ and check "Add Python to PATH".
    echo.
    pause
    exit /b 1
)

echo [+] Python environment verified.
echo [+] Installing agent dependencies (psutil, wmi, requests)...
python -m pip install psutil wmi requests --quiet >nul 2>&1

:: 2. Create Target Directory in AppData
SET "TARGET_DIR=%APPDATA%\ApexPulseAgent"
IF NOT EXIST "%TARGET_DIR%" (
    mkdir "%TARGET_DIR%"
)

:: 3. Copy Client Agent Script
copy /Y "%~dp0client_agent.py" "%TARGET_DIR%\client_agent.py" >nul
echo [+] Agent script installed to: %TARGET_DIR%\client_agent.py

:: 4. Add to Windows Startup Registry (Runs automatically on Windows startup)
SET "SERVER_URL=http://127.0.0.1:5000"
SET "REG_CMD=pythonw.exe "%TARGET_DIR%\client_agent.py" --server "%SERVER_URL%""
REG ADD "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "ApexPulseAgent" /t REG_SZ /d "%REG_CMD%" /f >nul

echo [+] Added to Windows Startup Registry (HKCU\...\Run\ApexPulseAgent).

:: 5. Launch Background Agent Immediately
echo [+] Launching telemetry agent service now...
start "" pythonw.exe "%TARGET_DIR%\client_agent.py" --server "%SERVER_URL%"

echo.
echo ============================================================
echo   SUCCESS! ApexPulse Agent is now running in the background.
echo   It will automatically launch whenever this device starts up!
echo ============================================================
echo.
pause
