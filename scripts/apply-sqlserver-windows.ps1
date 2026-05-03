# Applies database/sqlserver/*.sql using classic SQLCMD (ODBC 170+ Tools Binn).
# go-sqlcmd in PATH often targets the wrong pipe for full SQL Server; this script uses the legacy binary.
# Run: powershell -ExecutionPolicy Bypass -File .\scripts\apply-sqlserver-windows.ps1
# Optional: -Server "localhost\SQLEXPRESS"

param([string]$Server = "localhost\SQLEXPRESS")

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$sqlcmd = @(
  "${env:ProgramFiles}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE"
  "${env:ProgramFiles(x86)}\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $sqlcmd) {
  Write-Error "SQLCMD.EXE not found under Client SDK\ODBC\170\Tools\Binn. Install SQL Server Command Line Utilities."
}

$files = @(
  "00_create_database.sql", "01_schemas.sql", "02_tables_core.sql", "03_tables_visit.sql",
  "04_functions_procedures.sql", "05_bootstrap.sql", "06_queue_snapshot.sql"
)

foreach ($f in $files) {
  Write-Host "=== $f ==="
  & $sqlcmd -S $Server -E -C -I -b -i (Join-Path $root "database\sqlserver\$f")
}

Write-Host "Done."
