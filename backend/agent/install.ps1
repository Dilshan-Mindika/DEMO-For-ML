# ====================================================================
# ApexPulse Enterprise Client Agent PowerShell Installer
# Run as Administrator to install background monitoring service on laptop.
# Usage: .\install.ps1 -ServerUrl "http://192.168.1.50:5000"
# ====================================================================

param(
    [string]$ServerUrl = "http://127.0.0.1:5000"
)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  ApexPulse Client Telemetry Agent Installer" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Verify Python Installation
$pythonPath = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonPath) {
    Write-Host "[!] Python is not installed or not in PATH. Please install Python 3.10+ first." -ForegroundColor Red
    exit 1
}

Write-Host "[+] Python detected: $($pythonPath.Source)" -ForegroundColor Green

# 2. Install Required Packages
Write-Host "[+] Installing telemetry dependencies (psutil, wmi, requests)..." -ForegroundColor Yellow
pip install psutil wmi requests --quiet

# 3. Create Installation Directory
$installDir = "$env:ProgramData\ApexPulseAgent"
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir | Out-Null
}

# 4. Copy Client Agent Script
$scriptSrc = Join-Path $PSScriptRoot "client_agent.py"
$scriptDest = Join-Path $installDir "client_agent.py"
Copy-Item -Path $scriptSrc -Destination $scriptDest -Force
Write-Host "[+] Agent script copied to: $scriptDest" -ForegroundColor Green

# 5. Create Windows Scheduled Task (Runs every 30 minutes)
$taskName = "ApexPulseTelemetryAgent"
$action = New-ScheduledTaskAction -Execute "python.exe" -Argument "`"$scriptDest`" --server `"$ServerUrl`""
$trigger = New-ScheduledTaskTrigger -Daily -At "00:00"
$trigger.RepetitionInterval = (New-TimeSpan -Minutes 30)

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Description "ApexPulse Enterprise Hardware Telemetry Collector" -User "NT AUTHORITY\SYSTEM" -RunLevel Highest | Out-Null

Write-Host "[✓] Task '$taskName' registered successfully!" -ForegroundColor Green

# 6. Execute Initial Telemetry Send
Write-Host "[+] Sending initial hardware telemetry test..." -ForegroundColor Yellow
python "$scriptDest" --server "$ServerUrl"

Write-Host "`n[✓] ApexPulse Client Agent installation complete! Target laptop is now monitored." -ForegroundColor Green
