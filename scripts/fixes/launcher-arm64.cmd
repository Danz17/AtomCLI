@echo off
REM Claude Code ARM64 Compatibility Launcher
REM Attempts to run x64 binary on Windows ARM64 through emulation

echo Claude Code ARM64 Compatibility Launcher
echo ========================================
echo.

set "EXE=claude-code-windows-x64.exe"
set "BASELINE=claude-code-windows-x64-baseline.exe"

REM Method 1: Direct execution
echo Method 1: Direct execution...
if exist "dist\%EXE%" (
    dist\%EXE% --version
    if %ERRORLEVEL% EQU 0 goto :success
)

REM Method 2: x64 emulation layer
echo.
echo Method 2: Using x64 emulation layer...
if exist "%SystemRoot%\SysWOW64\cmd.exe" (
    %SystemRoot%\SysWOW64\cmd.exe /c "dist\%EXE% --version"
    if %ERRORLEVEL% EQU 0 goto :success
)

REM Method 3: Compatibility environment
echo.
echo Method 3: Setting compatibility environment...
set PROCESSOR_ARCHITECTURE=AMD64
if exist "dist\%EXE%" (
    dist\%EXE% --version
    if %ERRORLEVEL% EQU 0 goto :success
)

REM Method 4: Try baseline variant
echo.
echo Method 4: Trying baseline variant...
if exist "dist\%BASELINE%" (
    dist\%BASELINE% --version
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo Baseline variant works! Use: dist\%BASELINE%
        goto :success
    )
)

REM All methods failed
echo.
echo ========================================
echo ERROR: All compatibility methods failed
echo ========================================
echo.
echo This usually means:
echo - Bun runtime doesn't support Windows ARM64 x64 emulation
echo - Native modules (ripgrep) aren't compatible
echo.
echo Recommended alternatives:
echo 1. Use Wine through UTM on macOS/Linux
echo 2. Install Node.js for ARM64 and use: npm install -g @anthropic-ai/claude-code
echo 3. Wait for native Windows ARM64 support
echo.
exit /b 1

:success
echo.
echo SUCCESS: Binary is working!
exit /b 0
