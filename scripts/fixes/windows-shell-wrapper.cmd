@echo off
REM Claude Code Windows Shell Wrapper
REM Sets up POSIX shell environment before running Claude Code

echo Claude Code Shell Wrapper
echo ========================
echo.

REM Try to find a suitable shell

REM 1. Git Bash (most common)
for /f "tokens=*" %%i in ('where git 2^>nul') do (
    set "GIT_PATH=%%~dpi"
    goto :found_git
)
goto :check_wsl

:found_git
set "GIT_BASH=%GIT_PATH%..\bin\bash.exe"
if exist "%GIT_BASH%" (
    set "SHELL=%GIT_BASH%"
    echo Found Git Bash: %SHELL%
    goto :run
)

:check_wsl
REM 2. WSL
where wsl >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Found WSL
    set "SHELL=wsl"
    goto :run
)

REM 3. MSYS2
if exist "C:\msys64\usr\bin\bash.exe" (
    set "SHELL=C:\msys64\usr\bin\bash.exe"
    echo Found MSYS2 Bash
    goto :run
)

REM 4. Cygwin
if exist "C:\cygwin64\bin\bash.exe" (
    set "SHELL=C:\cygwin64\bin\bash.exe"
    echo Found Cygwin Bash
    goto :run
)

REM No shell found
echo.
echo ERROR: No suitable POSIX shell found!
echo.
echo Please install one of the following:
echo - Git for Windows (recommended - includes Git Bash)
echo   https://git-scm.com/download/win
echo.
echo - WSL (Windows Subsystem for Linux)
echo   Run in PowerShell: wsl --install
echo.
echo - MSYS2 (https://www.msys2.org/)
echo.
exit /b 1

:run
echo.
echo Setting up environment...
set "PATH=%~dp0;%PATH%"
set TERM=xterm-256color

echo Starting Claude Code...
echo.

REM Run with the arguments passed to this script
claude-code-windows-x64-baseline.exe %*
