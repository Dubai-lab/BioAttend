@echo off
REM ---------------------------------------------------------------------------
REM  BioAttend fingerprint bridge launcher
REM
REM  fpsapit.dll is 32-bit, so this MUST run on a 32-bit Python interpreter.
REM  The -32 suffix tells the py launcher to pick one.
REM ---------------------------------------------------------------------------
title BioAttend Fingerprint Bridge
cd /d "%~dp0"

py -3-32 --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo   ERROR: No 32-bit Python found.
    echo.
    echo   The fingerprint SDK is a 32-bit DLL and cannot be loaded by a
    echo   64-bit interpreter. Install the 32-bit build from python.org
    echo   ^(choose "Windows installer ^(32-bit^)"^) and tick
    echo   "Add python.exe to PATH" during setup.
    echo.
    echo   A 64-bit Python can stay installed alongside it; the py launcher
    echo   picks the right one.
    echo.
    pause
    exit /b 1
)

py -3-32 bioattend_bridge.py
pause
