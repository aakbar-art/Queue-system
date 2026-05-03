# Free dev ports (Node) then start web + API. Run from repo root:
#   powershell -ExecutionPolicy Bypass -File .\scripts\dev-windows.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $root "package.json"))) {
  throw "Run this script from the arcedge-queue repo (package.json not found at $root)."
}

Set-Location $root

function Stop-PortListeners([int[]]$Ports) {
  foreach ($p in $Ports) {
    Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
      ForEach-Object {
        $procId = $_.OwningProcess
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -match "^(node|tsx)$") {
          Write-Host "Stopping PID $procId ($($proc.ProcessName)) on port $p"
          Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
      }
  }
}

Write-Host "Freeing ports 3001 and 5173 (node/tsx only)..."
Stop-PortListeners @(3001, 5173)

if (-not (Test-Path "node_modules")) {
  Write-Host "Running npm install..."
  npm install
}

Write-Host "Starting npm run dev..."
npm run dev
