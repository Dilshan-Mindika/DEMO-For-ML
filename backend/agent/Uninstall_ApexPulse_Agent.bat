@echo off
TITLE ApexPulse Enterprise Client Agent v1.1.2 - 1-Click Uninstaller
COLOR 0C
CLS

echo ============================================================
echo   ApexPulse Enterprise Client Telemetry Agent Uninstaller v1.1.2
echo   Removing ApexPulse background service and startup keys...
echo ============================================================
echo.

:: 1. Terminate Running Agent Processes
echo [+] Stopping any running ApexPulse agent processes...
taskkill /F /IM ApexPulseAgent.exe /T >nul 2>&1
wmic process where "commandline like '%%client_agent.py%%'" call terminate >nul 2>&1
powershell -Command "Get-Process | Where-Object {$_.ProcessName -eq 'ApexPulseAgent' -or $_.CommandLine -like '*client_agent.py*'} | Stop-Process -Force" >nul 2>&1

:: 2. Remove Windows Startup Registry Key
echo [+] Removing Windows Startup Registry entry...
REG DELETE "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "ApexPulseAgent" /f >nul 2>&1

:: 3. Remove Scheduled Task (if created)
echo [+] Removing Scheduled Task if registered...
schtasks /Delete /TN "ApexPulseAgent" /F >nul 2>&1

:: 4. Delete Installed Files Directory
SET "TARGET_DIR=%APPDATA%\ApexPulseAgent"
IF EXIST "%TARGET_DIR%" (
    echo [+] Removing installed files in %TARGET_DIR%...
    rmdir /S /Q "%TARGET_DIR%" >nul 2>&1
)

echo.
echo ============================================================
echo   SUCCESS! ApexPulse Agent v1.1.2 has been completely uninstalled.
echo   No background telemetry service is running on this device.
echo ============================================================
echo.
pause
