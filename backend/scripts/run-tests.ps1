# PowerShell script to run Backend automated test suites
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   VIKMO DealerDesk - Backend Tests     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Split-Path -Parent $ScriptDir
$TestScript = Join-Path $BackendDir "tests\test_backend_contract.py"

Push-Location $BackendDir
try {
    Write-Host "`nRunning Backend Contract & Data Integrity Tests..." -ForegroundColor Yellow
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        uv run python $TestScript
    } elseif (Test-Path "$env:USERPROFILE\.local\bin\uv.exe") {
        & "$env:USERPROFILE\.local\bin\uv.exe" run python $TestScript
    } elseif (Get-Command py -ErrorAction SilentlyContinue) {
        py $TestScript
    } elseif (Get-Command python -ErrorAction SilentlyContinue) {
        python $TestScript
    } else {
        Write-Host "Python not found on PATH. Please ensure Python 3.11+ is installed." -ForegroundColor Red
        exit 1
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nBackend contract tests failed!" -ForegroundColor Red
        exit $LASTEXITCODE
    }

    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "   Backend Tests Completed Successfully! " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} finally {
    Pop-Location
}
