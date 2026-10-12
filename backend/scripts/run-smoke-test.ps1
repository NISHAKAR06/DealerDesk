# PowerShell script to run the assignment smoke test against a running backend
param (
    [string]$BaseUrl = "http://localhost:8000",
    [string]$Track = "django",
    [switch]$All = $false
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   VIKMO DealerDesk - Smoke Test Runner " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Split-Path -Parent $ScriptDir
$SmokeScript = Join-Path $BackendDir "smoke_test.py"
$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"

$smokeArgs = @("--base-url", $BaseUrl)
if ($All) {
    $smokeArgs += "--all"
} elseif ($Track) {
    $smokeArgs += @("--track", $Track)
}

Push-Location $BackendDir
try {
    Write-Host "Executing smoke_test.py with args: $smokeArgs" -ForegroundColor Yellow
    if (Test-Path $VenvPython) {
        & $VenvPython $SmokeScript @smokeArgs
    } elseif (Get-Command uv -ErrorAction SilentlyContinue) {
        uv run python $SmokeScript @smokeArgs
    } elseif (Test-Path "$env:USERPROFILE\.local\bin\uv.exe") {
        & "$env:USERPROFILE\.local\bin\uv.exe" run python $SmokeScript @smokeArgs
    } elseif (Get-Command py -ErrorAction SilentlyContinue) {
        py $SmokeScript @smokeArgs
    } elseif (Get-Command python -ErrorAction SilentlyContinue) {
        python $SmokeScript @smokeArgs
    } else {
        Write-Host "Python not found on PATH. Please ensure Python 3.11+ is installed." -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
