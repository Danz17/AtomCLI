# Download Claude Code source files
# Run this script in PowerShell to download the required large files

Write-Host "Claude Code Source Downloader" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

$projectDir = $PSScriptRoot
$tempDir = Join-Path $projectDir "temp-download"

# Create temp directory
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir | Out-Null
}

Write-Host "Downloading Claude Code package from npm..." -ForegroundColor Yellow

# Download the tarball
$tarballUrl = "https://registry.npmjs.org/@anthropic-ai/claude-code/-/claude-code-2.0.76.tgz"
$tarballPath = Join-Path $tempDir "claude-code.tgz"

try {
    Invoke-WebRequest -Uri $tarballUrl -OutFile $tarballPath
    Write-Host "Downloaded package successfully" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to download package: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Extracting package..." -ForegroundColor Yellow

# Extract using tar (available on Windows 10+)
Push-Location $tempDir
try {
    tar -xzf claude-code.tgz
    Write-Host "Extracted successfully" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to extract. Please install tar or use 7-Zip." -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

$packageDir = Join-Path $tempDir "package"

Write-Host ""
Write-Host "Copying files to project..." -ForegroundColor Yellow

# Copy main files
$filesToCopy = @("cli.js", "sdk.mjs", "yoga.wasm")
foreach ($file in $filesToCopy) {
    $src = Join-Path $packageDir $file
    $dst = Join-Path $projectDir $file
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
        Write-Host "  Copied $file" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: $file not found" -ForegroundColor Yellow
    }
}

# Copy vendor directory
$vendorSrc = Join-Path $packageDir "vendor"
$vendorDst = Join-Path $projectDir "vendor"

if (Test-Path $vendorSrc) {
    Write-Host "  Copying vendor directory..." -ForegroundColor Cyan
    Copy-Item -Path $vendorSrc -Destination $vendorDst -Recurse -Force
    Write-Host "  Copied vendor directory" -ForegroundColor Green
}

# Update package.json with correct version
Write-Host ""
Write-Host "Updating package.json..." -ForegroundColor Yellow
$pkgJsonSrc = Join-Path $packageDir "package.json"
$pkgJsonDst = Join-Path $projectDir "package.json"
if (Test-Path $pkgJsonSrc) {
    Copy-Item $pkgJsonSrc $pkgJsonDst -Force
    Write-Host "  Updated package.json" -ForegroundColor Green
}

# Cleanup
Write-Host ""
Write-Host "Cleaning up temporary files..." -ForegroundColor Yellow
Remove-Item -Path $tempDir -Recurse -Force
Write-Host "  Cleanup complete" -ForegroundColor Green

Write-Host ""
Write-Host "=============================" -ForegroundColor Cyan
Write-Host "Download complete!" -ForegroundColor Green
Write-Host ""
Write-Host "You can now build executables with:" -ForegroundColor Yellow
Write-Host "  bun run scripts/build/build-executables.js windows" -ForegroundColor Cyan
Write-Host ""
