# PowerShell script to run Backend automated test suites
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   VIKMO DealerDesk - Backend Tests     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Split-Path -Parent $ScriptDir
$ContractTest = Join-Path $BackendDir "tests\test_backend_contract.py"
$UnitTest = Join-Path $BackendDir "tests\test_unit_track1.py"
$Track2Test = Join-Path $BackendDir "tests\test_track2_ai_ml.py"
$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"

$pythonCmd = $null
if (Test-Path $VenvPython) {
    $pythonCmd = $VenvPython
} elseif (Get-Command uv -ErrorAction SilentlyContinue) {
    $pythonCmd = "uv run python"
} elseif (Test-Path "$env:USERPROFILE\.local\bin\uv.exe") {
    $pythonCmd = "$env:USERPROFILE\.local\bin\uv.exe"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonCmd = "py"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} else {
    Write-Host "Python not found on PATH. Please ensure Python 3.11+ is installed." -ForegroundColor Red
    exit 1
}

Push-Location $BackendDir
try {
    Write-Host "`n[1/3] Running Backend Contract & Data Integrity Tests..." -ForegroundColor Yellow
    if ($pythonCmd -eq $VenvPython) {
        & $pythonCmd $ContractTest
    } else {
        Invoke-Expression "$pythonCmd $ContractTest"
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Contract tests failed!" -ForegroundColor Red
        exit $LASTEXITCODE
    }

    Write-Host "`n[2/3] Running Track 1 Serializers, Pricing & Error Invariant Unit Tests..." -ForegroundColor Yellow
    if ($pythonCmd -eq $VenvPython) {
        & $pythonCmd $UnitTest
    } else {
        Invoke-Expression "$pythonCmd $UnitTest"
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Unit tests failed!" -ForegroundColor Red
        exit $LASTEXITCODE
    }

    Write-Host "`n[3/3] Running Track 2 AI Assistant, Forecasting & Reorder Engine Tests..." -ForegroundColor Yellow
    if ($pythonCmd -eq $VenvPython) {
        & $pythonCmd $Track2Test
    } else {
        Invoke-Expression "$pythonCmd $Track2Test"
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Track 2 tests failed!" -ForegroundColor Red
        exit $LASTEXITCODE
    }

    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "   All Backend Tests Completed Successfully! " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} finally {
    Pop-Location
}
