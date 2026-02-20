@echo off
setlocal enabledelayedexpansion
:: start_dev.bat — kill stale port bindings, remove lockfile, launch AutoHelper

set PORT=8100
set LOCKFILE=%APPDATA%\AutoHelper\autohelper.pid

:: Kill any process on the port
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%PORT% " ^| findstr "LISTENING" 2^>nul') do (
    echo Killing PID %%a on port %PORT%
    taskkill /F /PID %%a >nul 2>&1
)

:: Remove stale lockfile
if exist "%LOCKFILE%" (
    echo Removing stale lockfile: %LOCKFILE%
    del /f "%LOCKFILE%"
)

:: Launch
cd /d "%~dp0\.."
echo Starting AutoHelper on port %PORT%...
python -m autohelper.main
