# Starts SQL Server in Docker and applies database/scripts if sqlcmd is available.
# Prerequisites: Docker Desktop installed and running.
# Run from repo root (same folder as package.json):
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-sql-docker.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

function Test-Docker {
  try {
    & docker version 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

if (-not (Test-Docker)) {
  Write-Host @"
Docker was not found. Install Docker Desktop for Windows, then re-run this script.
Optional (admin PowerShell):
  winget install Docker.DockerDesktop --accept-package-agreements --accept-source-agreements

Without Docker/SQL Server the API still runs using file snapshots (server/data/snapshot.json).
"@
  exit 1
}

Write-Host "Starting SQL Server container..."
docker compose up -d

$db = "ArcEdge Queue"
$sa = "ArcEdge_Dev_1!"
$sqlFiles = @(
  "database/sqlserver/00_create_database.sql",
  "database/sqlserver/01_schemas.sql",
  "database/sqlserver/02_tables_core.sql",
  "database/sqlserver/03_tables_visit.sql",
  "database/sqlserver/04_functions_procedures.sql",
  "database/sqlserver/05_bootstrap.sql",
  "database/sqlserver/06_queue_snapshot.sql"
)

$sqlcmd = $null
foreach ($c in @(
    "sqlcmd",
    "${env:ProgramFiles}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\sqlcmd.exe",
    "${env:ProgramFiles(x86)}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\sqlcmd.exe"
  )) {
  if (Get-Command $c -ErrorAction SilentlyContinue) { $sqlcmd = $c; break }
  if (Test-Path $c) { $sqlcmd = $c; break }
}

if (-not $sqlcmd) {
  Write-Host @"
Docker SQL is running on localhost:1433 (sa / $sa).

sqlcmd was not found. Install SQL Server Command Line Utilities or run scripts manually in SSMS:
  https://learn.microsoft.com/sql/tools/sqlcmd-utility

Copy server/.env.example to server/.env and set:
  SQL_SERVER=localhost
  SQL_DATABASE=$db
  SQL_USER=sa
  SQL_PASSWORD=$sa
  SQL_ENCRYPT=true
  SQL_TRUST_CERT=true
"@
  exit 0
}

Write-Host "Applying SQL scripts with $sqlcmd ..."
foreach ($f in $sqlFiles) {
  $full = Join-Path $root $f
  if (-not (Test-Path $full)) { Write-Warning "Missing $full"; continue }
  Write-Host "  -> $f"
  & $sqlcmd -S "localhost,1433" -U sa -P $sa -i $full
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "sqlcmd failed on $f (exit $LASTEXITCODE)"
  }
}

Write-Host @"

Next: copy server/.env.example to server/.env and set SQL_* as printed above.
Restart the API and open http://localhost:3001/api/health (snapshotStore should be sql, db true).
"@
