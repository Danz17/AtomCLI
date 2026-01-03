@echo off
setlocal EnableDelayedExpansion

:: ============================================================================
::                              ATOMCLI LAUNCHER
::                         Windows Batch Bootstrap
:: ============================================================================
:: Detects available runtimes and launches AtomCLI with user's choice
:: ============================================================================

title AtomCLI Launcher

:: Colors (Windows 10+)
set "ESC="
set "GREEN=%ESC%[92m"
set "YELLOW=%ESC%[93m"
set "CYAN=%ESC%[96m"
set "RED=%ESC%[91m"
set "RESET=%ESC%[0m"
set "BOLD=%ESC%[1m"

:: Banner
echo.
echo %CYAN%   =======================================%RESET%
echo %CYAN%   =        %BOLD%AtomCLI Launcher%RESET%%CYAN%           =%RESET%
echo %CYAN%   =  Cross-Platform CLI Build System   =%RESET%
echo %CYAN%   =======================================%RESET%
echo.

:: Detect available runtimes
set "HAS_BUN=0"
set "HAS_NODE=0"
set "BUN_VERSION="
set "NODE_VERSION="

:: Check for Bun
where bun >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "HAS_BUN=1"
    for /f "tokens=*" %%i in ('bun --version 2^>nul') do set "BUN_VERSION=%%i"
)

:: Check for Node.js
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "HAS_NODE=1"
    for /f "tokens=*" %%i in ('node --version 2^>nul') do set "NODE_VERSION=%%i"
)

:: Show detected runtimes
echo %YELLOW%Detected Runtimes:%RESET%
echo.

if "%HAS_BUN%"=="1" (
    echo   %GREEN%[*]%RESET% Bun %BUN_VERSION%
) else (
    echo   %RED%[ ]%RESET% Bun ^(not installed^)
)

if "%HAS_NODE%"=="1" (
    echo   %GREEN%[*]%RESET% Node.js %NODE_VERSION%
) else (
    echo   %RED%[ ]%RESET% Node.js ^(not installed^)
)

echo.

:: Check if any runtime is available
if "%HAS_BUN%"=="0" if "%HAS_NODE%"=="0" (
    echo %RED%ERROR: No JavaScript runtime found!%RESET%
    echo.
    echo Please install one of the following:
    echo   - Bun:     https://bun.sh
    echo   - Node.js: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: If only one runtime available, use it
if "%HAS_BUN%"=="1" if "%HAS_NODE%"=="0" (
    echo %GREEN%Using Bun %BUN_VERSION%%RESET%
    echo.
    bun "%~dp0atom.js" %*
    goto :end
)

if "%HAS_BUN%"=="0" if "%HAS_NODE%"=="1" (
    echo %GREEN%Using Node.js %NODE_VERSION%%RESET%
    echo.
    node "%~dp0atom.js" %*
    goto :end
)

:: Both available - let user choose
echo %CYAN%Select Runtime:%RESET%
echo.
echo   [1] Bun %BUN_VERSION% %YELLOW%(Recommended)%RESET%
echo   [2] Node.js %NODE_VERSION%
echo   [Q] Quit
echo.

choice /c 12Q /n /m "Enter choice (1/2/Q): "

if %ERRORLEVEL% EQU 1 (
    echo.
    echo %GREEN%Starting with Bun...%RESET%
    echo.
    bun "%~dp0atom.js" %*
    goto :end
)

if %ERRORLEVEL% EQU 2 (
    echo.
    echo %GREEN%Starting with Node.js...%RESET%
    echo.
    node "%~dp0atom.js" %*
    goto :end
)

if %ERRORLEVEL% EQU 3 (
    echo.
    echo %YELLOW%Goodbye!%RESET%
    goto :end
)

:end
endlocal
