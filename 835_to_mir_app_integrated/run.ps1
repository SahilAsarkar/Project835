Set-Location $PSScriptRoot
if (-not (Test-Path ".venv\Scripts\python.exe")) {
    py -3.12 -m venv .venv
}
& ".venv\Scripts\Activate.ps1"
python -m pip install -r requirements.txt
Start-Process "http://127.0.0.1:8000"
python -m uvicorn app:app --host 127.0.0.1 --port 8000
