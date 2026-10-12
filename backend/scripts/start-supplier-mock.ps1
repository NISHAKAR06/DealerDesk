# PowerShell script to start the local Mock Supplier server
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   DealerDesk Mock Supplier Server      " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Split-Path -Parent $ScriptDir
$MockScript = Join-Path $BackendDir "supplier_mock\mock_supplier.py"

Push-Location $BackendDir
try {
    Write-Host "Starting Mock Supplier on port 9000..." -ForegroundColor Yellow
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        uv run python $MockScript @args
    } elseif (Test-Path "$env:USERPROFILE\.local\bin\uv.exe") {
        & "$env:USERPROFILE\.local\bin\uv.exe" run python $MockScript @args
    } elseif (Get-Command py -ErrorAction SilentlyContinue) {
        py $MockScript @args
    } elseif (Get-Command python -ErrorAction SilentlyContinue) {
        python $MockScript @args
    } else {
        Write-Host "Python not found on PATH. Install Python 3.11+ to run the mock supplier." -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
