# Auto Commit Script
# This script watches the repository for changes and automatically stages and commits them.

# Create a flag file to prevent re-entrancy
$flagFile = ".auto_commit_running"

if (Test-Path $flagFile) {
    Write-Host "Auto commit script is already running. Exiting to avoid recursion."
    exit
}

# Create the flag file
New-Item -Path $flagFile -ItemType File | Out-Null

function Commit-Changes {
    try {
        git add .
        $commitMessage = "Auto commit at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        git commit -m $commitMessage
        Write-Host "Committed changes: $commitMessage"
    } catch {
        Write-Error "Failed to commit changes: $_"
    }
}

# Initial commit of current state
Commit-Changes

# Set up file system watcher
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = "."
$watcher.Filter = "*.*"
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

# Event handler for changed files
$onChanged = Register-ObjectEvent $watcher Changed -SourceIdentifier FileChanged -Action {
    # Debounce to avoid multiple events for the same change
    if ($global:lastCommitTime -eq $null -or (Get-Date) -gt $global:lastCommitTime.AddSeconds(2)) {
        $global:lastCommitTime = Get-Date
        Commit-Changes
    }
}

Write-Host "Watching for changes. Press Ctrl+C to stop."

# Keep the script running
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    # Cleanup
    Unregister-Event -SourceIdentifier FileChanged
    $watcher.EnableRaisingEvents = $false
    Remove-Item $flagFile -Force -ErrorAction SilentlyContinue
}