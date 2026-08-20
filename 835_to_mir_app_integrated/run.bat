@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if errorlevel 1 (
  echo Python launcher "py" was not found. Install Python 3.12 and try again.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo Creating Python 3.12 virtual environment...
  py -3.12 -m venv .venv
  if errorlevel 1 (
    echo Could not create a Python 3.12 environment.
    echo Make sure Python 3.12 is installed.
    pause
    exit /b 1
  )
)

call ".venv\Scripts\activate.bat"
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

start "" powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:8000'"
echo.
echo 835 to MIR Converter is starting at http://127.0.0.1:8000
echo Keep this window open while using the app.
echo Press CTRL+C to stop it.
echo.
python -m uvicorn app:app --host 127.0.0.1 --port 8000
endlocal
