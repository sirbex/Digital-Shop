# ============================================================================
# DigitalShop - Automated Database Backup Script
# ============================================================================
# Usage:
#   .\backup-db.ps1                     # Full backup with defaults
#   .\backup-db.ps1 -RetainDays 14      # Keep 14 days of backups
#   .\backup-db.ps1 -BackupDir "D:\Backups"  # Custom backup directory
#
# Schedule with Windows Task Scheduler:
#   Action: powershell.exe
#   Arguments: -ExecutionPolicy Bypass -File "C:\Users\Chase\SimpleShopUG\scripts\backup-db.ps1"
#   Trigger: Daily at 02:00 AM
# ============================================================================

param(
    [string]$BackupDir = "C:\Users\Chase\SimpleShopUG\backups",
    [string]$DatabaseName = "digitalshop",
    [string]$PgUser = "postgres",
    [string]$PgHost = "localhost",
    [int]$PgPort = 5432,
    [string]$PgPassword = "02102010",
    [int]$RetainDays = 7,
    [switch]$Verbose
)

# ============================================================================
# CONFIGURATION
# ============================================================================

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFileName = "${DatabaseName}_${timestamp}.sql"
$compressedFileName = "${backupFileName}.gz"
$logFile = Join-Path $BackupDir "backup.log"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [$Level] $Message"
    Add-Content -Path $logFile -Value $logEntry -ErrorAction SilentlyContinue
    if ($Verbose -or $Level -eq "ERROR") {
        switch ($Level) {
            "ERROR" { Write-Host $logEntry -ForegroundColor Red }
            "WARN"  { Write-Host $logEntry -ForegroundColor Yellow }
            "OK"    { Write-Host $logEntry -ForegroundColor Green }
            default { Write-Host $logEntry }
        }
    }
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

try {
    # 1. Ensure backup directory exists
    if (-not (Test-Path $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
        Write-Log "Created backup directory: $BackupDir"
    }

    Write-Log "=== Starting backup of '$DatabaseName' ==="

    # 2. Find pg_dump executable
    $pgDump = $null
    $pgPaths = @(
        "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe"
    )
    foreach ($p in $pgPaths) {
        if (Test-Path $p) { $pgDump = $p; break }
    }
    # Fall back to PATH
    if (-not $pgDump) {
        $pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source
    }
    if (-not $pgDump) {
        throw "pg_dump not found. Install PostgreSQL or add its bin/ to PATH."
    }
    Write-Log "Using pg_dump: $pgDump"

    # 3. Set password environment variable for pg_dump
    $env:PGPASSWORD = $PgPassword

    # 4. Run pg_dump (plain SQL format for portability)
    $backupPath = Join-Path $BackupDir $backupFileName
    $pgArgs = @(
        "-h", $PgHost,
        "-p", $PgPort,
        "-U", $PgUser,
        "-d", $DatabaseName,
        "--no-owner",
        "--no-acl",
        "--clean",
        "--if-exists",
        "-f", $backupPath
    )

    Write-Log "Running pg_dump..."
    $process = Start-Process -FilePath $pgDump -ArgumentList $pgArgs -NoNewWindow -Wait -PassThru -RedirectStandardError (Join-Path $BackupDir "pg_dump_stderr.tmp")
    
    if ($process.ExitCode -ne 0) {
        $stderrContent = Get-Content (Join-Path $BackupDir "pg_dump_stderr.tmp") -Raw -ErrorAction SilentlyContinue
        throw "pg_dump exited with code $($process.ExitCode). Stderr: $stderrContent"
    }
    Remove-Item (Join-Path $BackupDir "pg_dump_stderr.tmp") -ErrorAction SilentlyContinue

    # 5. Verify backup file exists and has content
    if (-not (Test-Path $backupPath)) {
        throw "Backup file was not created: $backupPath"
    }
    $backupSize = (Get-Item $backupPath).Length
    if ($backupSize -lt 1024) {
        throw "Backup file is suspiciously small ($backupSize bytes). Possible pg_dump error."
    }

    # 6. Compress with gzip (PowerShell built-in)
    $compressedPath = Join-Path $BackupDir $compressedFileName
    try {
        # Use .NET GZipStream for compression
        $sourceStream = [System.IO.File]::OpenRead($backupPath)
        $destStream = [System.IO.File]::Create($compressedPath)
        $gzipStream = New-Object System.IO.Compression.GZipStream($destStream, [System.IO.Compression.CompressionMode]::Compress)
        $sourceStream.CopyTo($gzipStream)
        $gzipStream.Dispose()
        $destStream.Dispose()
        $sourceStream.Dispose()
        
        # Remove uncompressed file
        Remove-Item $backupPath -Force
        $compressedSize = (Get-Item $compressedPath).Length
        $ratio = [math]::Round(($compressedSize / $backupSize) * 100, 1)
        Write-Log "Compressed: $([math]::Round($backupSize/1KB, 1)) KB -> $([math]::Round($compressedSize/1KB, 1)) KB ($ratio%)"
    }
    catch {
        Write-Log "Compression failed, keeping uncompressed backup: $_" "WARN"
        $compressedPath = $backupPath
        $compressedSize = $backupSize
    }

    Write-Log "Backup saved: $compressedPath ($([math]::Round($compressedSize/1KB, 1)) KB)" "OK"

    # 7. Cleanup old backups (retain only last N days)
    $cutoffDate = (Get-Date).AddDays(-$RetainDays)
    $oldBackups = Get-ChildItem -Path $BackupDir -Filter "${DatabaseName}_*.sql*" |
        Where-Object { $_.LastWriteTime -lt $cutoffDate }
    
    if ($oldBackups.Count -gt 0) {
        Write-Log "Removing $($oldBackups.Count) backup(s) older than $RetainDays days..."
        $oldBackups | ForEach-Object {
            Remove-Item $_.FullName -Force
            Write-Log "  Deleted: $($_.Name)"
        }
    }

    # 8. Summary
    $remainingBackups = (Get-ChildItem -Path $BackupDir -Filter "${DatabaseName}_*.sql*").Count
    Write-Log "=== Backup complete. $remainingBackups backup(s) retained. ===" "OK"

    # Clear password from environment
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

    exit 0
}
catch {
    Write-Log "BACKUP FAILED: $_" "ERROR"
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    exit 1
}
