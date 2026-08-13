# Local-safe checks (no live tenant flood, no dropDatabase).
# From repo root:
#   powershell -File ops/run-local-checks.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
Set-Location backend
npm test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Isolation/CSRF/money/SLO unit tests passed. Live Newman/k6: see ops/LIVE_VERIFICATION.md"
