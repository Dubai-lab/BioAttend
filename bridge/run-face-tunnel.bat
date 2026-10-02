@echo off
REM ---------------------------------------------------------------------------
REM  BioAttend face service tunnel
REM
REM  Gives the face service on this PC a public https address through a free
REM  Cloudflare quick tunnel, so a phone can use its own camera for enrolment
REM  and face check-in while recognition still runs here.
REM
REM  Start run-face-service.bat FIRST and leave both windows open.
REM
REM  The address changes every time this is started. Copy the
REM  https://....trycloudflare.com line it prints and paste it on the phone
REM  under Devices -> Face service.
REM
REM  Anyone holding the address can reach the face service while this window is
REM  open, so close it when you have finished testing.
REM ---------------------------------------------------------------------------
title BioAttend Face Tunnel
cd /d "%~dp0"

REM  No parenthesised blocks here: "Program Files (x86)" contains a closing
REM  bracket, which ends an if-block early when the variable is expanded.
set "CLOUDFLARED=cloudflared"
where cloudflared >nul 2>&1
if not errorlevel 1 goto :found

set "CLOUDFLARED=%ProgramFiles(x86)%\cloudflared\cloudflared.exe"
if exist "%CLOUDFLARED%" goto :found

set "CLOUDFLARED=%ProgramFiles%\cloudflared\cloudflared.exe"
if exist "%CLOUDFLARED%" goto :found

echo.
echo   ERROR: cloudflared is not installed.
echo.
echo   Install it with:
echo       winget install --id Cloudflare.cloudflared
echo.
pause
exit /b 1

:found
echo.
echo   Opening a tunnel to the face service on http://127.0.0.1:8322
echo   Look for the line ending in  .trycloudflare.com  below.
echo.

"%CLOUDFLARED%" tunnel --url http://127.0.0.1:8322
pause
