@echo off
TITLE ApexPulse Enterprise Client Agent v1.1.2 - 1-Click Installer
COLOR 0A
CLS

echo ============================================================
echo   ApexPulse Enterprise Client Telemetry Agent Installer v1.1.2
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

:: 3. Copy or Download Client Agent Script
IF EXIST "%~dp0client_agent.py" (
    copy /Y "%~dp0client_agent.py" "%TARGET_DIR%\client_agent.py" >nul
) ELSE (
    echo [+] Downloading latest telemetry agent script from central server...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://apex-ml.vercel.app/downloads/client_agent.py' -OutFile '%TARGET_DIR%\client_agent.py'" >nul 2>&1
)
echo [+] Agent script installed to: %TARGET_DIR%\client_agent.py

:: 4. Set Server URL (Use argument %1 if provided, else environment variable or fallback)
IF "%~1" NEQ "" (
    SET "SERVER_URL=%~1"
) ELSE IF "%SERVER_URL%"=="" (
    SET "SERVER_URL=https://apex-ml-back.vercel.app"
)

echo [+] Central Server URL set to: %SERVER_URL%

:: 5. Create Silent VBScript Background Runner (Zero CMD Pop-Up)
SET "VBS_PATH=%TARGET_DIR%\run_agent.vbs"
(
    echo Set WshShell = CreateObject^("WScript.Shell"^)^
    echo WshShell.Run "pythonw.exe """ ^& WshShell.ExpandEnvironmentStrings^("%APPDATA%"^)^ & "\ApexPulseAgent\client_agent.py"" --server ""%SERVER_URL%""", 0, False
) > "%VBS_PATH%"

echo [+] Created silent VBScript background launcher at: %VBS_PATH%

:: 6. Register Silent VBScript Launcher in Windows Startup Registry
REG ADD "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "ApexPulseAgent" /t REG_SZ /d "wscript.exe \"%VBS_PATH%\"" /f >nul

echo [+] Registered in Windows Startup Registry (HKCU\...\Run\ApexPulseAgent).

:: 7. Launch Background Agent Immediately & Auto-Close Installer Window
echo [+] Launching telemetry agent service silently in background...
start "" wscript.exe "%VBS_PATH%"

echo.
echo ============================================================
echo   SUCCESS! ApexPulse Agent v1.1.2 installed successfully.
echo   Running silently in background. This installer will close automatically.
echo ============================================================
echo.
timeout /t 3 /nobreak >nul
exit /b 0
