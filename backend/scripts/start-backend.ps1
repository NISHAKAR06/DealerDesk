# PowerShell script to run migrations, seed data, and start Django server
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   DealerDesk Django Backend Server     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Split-Path -Parent $ScriptDir
$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"

Push-Location $BackendDir
try {
    Write-Host "`nRunning database migrations..." -ForegroundColor Yellow
    if (Test-Path $VenvPython) {
        & $VenvPython manage.py migrate --noinput
        Write-Host "`nSeeding catalogue & dealers..." -ForegroundColor Yellow
        & $VenvPython manage.py seed_data
        Write-Host "`nStarting Django server on 0.0.0.0:8000..." -ForegroundColor Green
        & $VenvPython manage.py runserver 0.0.0.0:8000
    } elseif (Get-Command uv -ErrorAction SilentlyContinue) {
        uv run python manage.py migrate --noinput
        Write-Host "`nSeeding catalogue & dealers..." -ForegroundColor Yellow
        uv run python manage.py seed_data
        Write-Host "`nStarting Django server on 0.0.0.0:8000..." -ForegroundColor Green
        uv run python manage.py runserver 0.0.0.0:8000
    } elseif (Test-Path "$env:USERPROFILE\.local\bin\uv.exe") {
        & "$env:USERPROFILE\.local\bin\uv.exe" run python manage.py migrate --noinput
        Write-Host "`nSeeding catalogue & dealers..." -ForegroundColor Yellow
        & "$env:USERPROFILE\.local\bin\uv.exe" run python manage.py seed_data
        Write-Host "`nStarting Django server on 0.0.0.0:8000..." -ForegroundColor Green
        & "$env:USERPROFILE\.local\bin\uv.exe" run python manage.py runserver 0.0.0.0:8000
    } elseif (Get-Command py -ErrorAction SilentlyContinue) {
        py manage.py migrate --noinput
        py manage.py seed_data
        py manage.py runserver 0.0.0.0:8000
    } elseif (Get-Command python -ErrorAction SilentlyContinue) {
        python manage.py migrate --noinput
        python manage.py seed_data
        python manage.py runserver 0.0.0.0:8000
    } else {
        Write-Host "Python not found on PATH. Please ensure Python 3.11+ is installed." -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
