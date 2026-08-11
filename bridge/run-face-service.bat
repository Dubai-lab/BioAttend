@echo off
REM ---------------------------------------------------------------------------
REM  BioAttend face recognition service
REM
REM  Runs InsightFace (SCRFD + ArcFace) on this machine and exposes it to the
REM  browser on 127.0.0.1:8322.
REM
REM  Separate from the fingerprint bridge because the two cannot share an
REM  interpreter: the fingerprint DLL is 32-bit, InsightFace needs 64-bit.
REM  Both must be running for the full system.
REM ---------------------------------------------------------------------------
title BioAttend Face Service
cd /d "%~dp0"

if not exist ".venv-face\Scripts\python.exe" (
    echo.
    echo   ERROR: the face environment is missing.
    echo.
    echo   Create it with 64-bit Python 3.12:
    echo       py -3.12 -m venv .venv-face
    echo       .venv-face\Scripts\python.exe -m pip install onnxruntime numpy opencv-python-headless insightface
    echo.
    pause
    exit /b 1
)

.venv-face\Scripts\python.exe face_service.py
pause
