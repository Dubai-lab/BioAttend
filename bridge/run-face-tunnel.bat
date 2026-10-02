@echo off
REM ---------------------------------------------------------------------------
REM  BioAttend face service tunnel
REM
REM  Gives the face service on this PC a public https address through a free
REM  Cloudflare quick tunnel, so a phone can use its own camera for enrolment
REM  and face check-in while recognition still runs here.
REM
REM  The address is published to Supabase automatically, so the site finds it
REM  on any phone without anything being typed.
REM
REM  Start run-face-service.bat FIRST and leave both windows open.
REM
REM  Anyone holding the address can reach the face service while this window is
REM  open, so close it when you have finished testing.
REM ---------------------------------------------------------------------------
title BioAttend Face Tunnel
cd /d "%~dp0"

if not exist ".venv-face\Scripts\python.exe" goto :nopython

.venv-face\Scripts\python.exe face_tunnel.py
pause
exit /b

:nopython
echo.
echo   ERROR: the face environment is missing. Run run-face-service.bat first;
echo   it explains how to create it.
echo.
pause
exit /b 1
