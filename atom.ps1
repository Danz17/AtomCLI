#!/usr/bin/env pwsh
<#
.SYNOPSIS
    AtomCLI Launcher - PowerShell Bootstrap Script

.DESCRIPTION
    Detects available JavaScript runtimes and launches AtomCLI.
    Supports Bun and Node.js with user selection when multiple are available.

.PARAMETER Runtime
    Force specific runtime: 'bun' or 'node'

.PARAMETER Help
    Show help information

.EXAMPLE
    .\atom.ps1
    Launch with runtime auto-detection/selection

.EXAMPLE
    .\atom.ps1 -Runtime bun
    Force launch with Bun runtime
#>

param(
    [ValidateSet('bun', 'node', 'auto')]
    [string]$Runtime = 'auto',
    [switch]$Help
)

# ============================================================================
#                              ATOMCLI LAUNCHER
#                        PowerShell Bootstrap Script
# ============================================================================

$ErrorActionPreference = 'Stop'
$Script:ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ─────────────────────────────────────────────────────────────────────────────
# Color Functions
# ─────────────────────────────────────────────────────────────────────────────

function Write-Color {
    param(
        [string]$Text,
        [string]$Color = 'White',
        [switch]$NoNewline
    )
    $params = @{ ForegroundColor = $Color; NoNewline = $NoNewline }
    Write-Host $Text @params
}

function Write-Banner {
    $banner = @"

   ╔═══════════════════════════════════════════════════════════╗
   ║                     ⚛️  ATOMCLI  ⚛️                        ║
   ║            Cross-Platform CLI Build System                ║
   ╚═══════════════════════════════════════════════════════════╝

"@
    Write-Color $banner -Color Cyan
}

# ─────────────────────────────────────────────────────────────────────────────
# Runtime Detection
# ─────────────────────────────────────────────────────────────────────────────

function Test-Command {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

function Get-RuntimeInfo {
    $runtimes = @{
        bun = @{
            Available = $false
            Version = $null
            Path = $null
        }
        node = @{
            Available = $false
            Version = $null
            Path = $null
        }
    }

    # Check Bun
    if (Test-Command 'bun') {
        $runtimes.bun.Available = $true
        try {
            $runtimes.bun.Version = (bun --version 2>$null).Trim()
            $runtimes.bun.Path = (Get-Command bun).Source
        } catch {}
    }

    # Check Node.js
    if (Test-Command 'node') {
        $runtimes.node.Available = $true
        try {
            $runtimes.node.Version = (node --version 2>$null).Trim()
            $runtimes.node.Path = (Get-Command node).Source
        } catch {}
    }

    return $runtimes
}

function Show-RuntimeStatus {
    param($Runtimes)

    Write-Color "Detected Runtimes:" -Color Yellow
    Write-Host ""

    if ($Runtimes.bun.Available) {
        Write-Color "  [" -NoNewline
        Write-Color "✓" -Color Green -NoNewline
        Write-Color "] Bun " -NoNewline
        Write-Color $Runtimes.bun.Version -Color DarkGray
    } else {
        Write-Color "  [" -NoNewline
        Write-Color " " -NoNewline
        Write-Color "] Bun " -NoNewline
        Write-Color "(not installed)" -Color DarkGray
    }

    if ($Runtimes.node.Available) {
        Write-Color "  [" -NoNewline
        Write-Color "✓" -Color Green -NoNewline
        Write-Color "] Node.js " -NoNewline
        Write-Color $Runtimes.node.Version -Color DarkGray
    } else {
        Write-Color "  [" -NoNewline
        Write-Color " " -NoNewline
        Write-Color "] Node.js " -NoNewline
        Write-Color "(not installed)" -Color DarkGray
    }

    Write-Host ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Runtime Selection Menu
# ─────────────────────────────────────────────────────────────────────────────

function Show-RuntimeMenu {
    param($Runtimes)

    Write-Color "Select Runtime:" -Color Cyan
    Write-Host ""

    $options = @()

    if ($Runtimes.bun.Available) {
        $options += @{
            Key = '1'
            Name = 'bun'
            Label = "Bun $($Runtimes.bun.Version)"
            Recommended = $true
        }
    }

    if ($Runtimes.node.Available) {
        $options += @{
            Key = ([string]($options.Count + 1))
            Name = 'node'
            Label = "Node.js $($Runtimes.node.Version)"
            Recommended = !$Runtimes.bun.Available
        }
    }

    foreach ($opt in $options) {
        Write-Color "  [$($opt.Key)] " -NoNewline
        Write-Color $opt.Label -NoNewline
        if ($opt.Recommended) {
            Write-Color " (Recommended)" -Color Yellow
        } else {
            Write-Host ""
        }
    }

    Write-Color "  [Q] Quit" -Color DarkGray
    Write-Host ""

    $validKeys = $options.Key + 'Q' + 'q'

    do {
        Write-Color "Enter choice: " -NoNewline -Color Cyan
        $key = [Console]::ReadKey($true).KeyChar
        Write-Host $key
    } while ($key -notin $validKeys)

    if ($key -eq 'Q' -or $key -eq 'q') {
        return $null
    }

    $selected = $options | Where-Object { $_.Key -eq $key }
    return $selected.Name
}

# ─────────────────────────────────────────────────────────────────────────────
# Main Execution
# ─────────────────────────────────────────────────────────────────────────────

function Start-AtomCLI {
    param([string]$SelectedRuntime)

    $atomScript = Join-Path $Script:ScriptDir "atom.js"

    if (-not (Test-Path $atomScript)) {
        Write-Color "ERROR: atom.js not found at $atomScript" -Color Red
        exit 1
    }

    Write-Host ""
    Write-Color "Starting AtomCLI with $SelectedRuntime..." -Color Green
    Write-Host ""

    switch ($SelectedRuntime) {
        'bun' {
            & bun $atomScript $args
        }
        'node' {
            & node $atomScript $args
        }
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────────────────────────────────────

if ($Help) {
    Get-Help $MyInvocation.MyCommand.Path -Detailed
    exit 0
}

# Show banner
Write-Banner

# Detect runtimes
$runtimes = Get-RuntimeInfo
Show-RuntimeStatus $runtimes

# Check if any runtime available
$availableCount = @($runtimes.GetEnumerator() | Where-Object { $_.Value.Available }).Count

if ($availableCount -eq 0) {
    Write-Host ""
    Write-Color "ERROR: No JavaScript runtime found!" -Color Red
    Write-Host ""
    Write-Host "Please install one of the following:"
    Write-Host "  - Bun:     https://bun.sh"
    Write-Host "  - Node.js: https://nodejs.org"
    Write-Host ""
    exit 1
}

# Determine which runtime to use
$selectedRuntime = $null

if ($Runtime -ne 'auto') {
    # User specified runtime
    if ($runtimes[$Runtime].Available) {
        $selectedRuntime = $Runtime
    } else {
        Write-Color "ERROR: Requested runtime '$Runtime' is not available" -Color Red
        exit 1
    }
} elseif ($availableCount -eq 1) {
    # Only one runtime available
    $selectedRuntime = ($runtimes.GetEnumerator() | Where-Object { $_.Value.Available }).Name
    Write-Color "Using $selectedRuntime (only available runtime)" -Color Green
} else {
    # Multiple runtimes - let user choose
    $selectedRuntime = Show-RuntimeMenu $runtimes

    if ($null -eq $selectedRuntime) {
        Write-Host ""
        Write-Color "Goodbye!" -Color Yellow
        exit 0
    }
}

# Launch AtomCLI
Start-AtomCLI $selectedRuntime
