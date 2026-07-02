@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run this app.
  echo Install Node.js from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo Failed to install dependencies.
    pause
    exit /b 1
  )
)

echo Starting Shri Tech Partners Registration app...
echo.
echo Open the local URL shown below in your browser.
echo Press Ctrl+C in this window to stop the app.
echo.

call npm.cmd run dev -- --host 127.0.0.1

pause
