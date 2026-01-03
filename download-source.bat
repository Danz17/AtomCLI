@echo off
REM Download Claude Code source files
REM Run this script to download the required large files

echo Claude Code Source Downloader
echo =============================
echo.

set "PROJECT_DIR=%~dp0"
set "TEMP_DIR=%PROJECT_DIR%temp-download"

REM Create temp directory
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"

echo Downloading Claude Code package from npm...

REM Download using curl (available on Windows 10+)
curl -L -o "%TEMP_DIR%\claude-code.tgz" "https://registry.npmjs.org/@anthropic-ai/claude-code/-/claude-code-2.0.76.tgz"

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to download package
    echo Please ensure curl is available or download manually from:
    echo https://registry.npmjs.org/@anthropic-ai/claude-code/-/claude-code-2.0.76.tgz
    pause
    exit /b 1
)

echo Downloaded package successfully
echo.

echo Extracting package...
cd /d "%TEMP_DIR%"
tar -xzf claude-code.tgz

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to extract. Please install tar or use 7-Zip.
    pause
    exit /b 1
)

echo Extracted successfully
echo.

echo Copying files to project...

REM Copy main files
if exist "%TEMP_DIR%\package\cli.js" (
    copy /Y "%TEMP_DIR%\package\cli.js" "%PROJECT_DIR%cli.js"
    echo   Copied cli.js
)

if exist "%TEMP_DIR%\package\sdk.mjs" (
    copy /Y "%TEMP_DIR%\package\sdk.mjs" "%PROJECT_DIR%sdk.mjs"
    echo   Copied sdk.mjs
)

if exist "%TEMP_DIR%\package\yoga.wasm" (
    copy /Y "%TEMP_DIR%\package\yoga.wasm" "%PROJECT_DIR%yoga.wasm"
    echo   Copied yoga.wasm
)

REM Copy vendor directory
if exist "%TEMP_DIR%\package\vendor" (
    echo   Copying vendor directory...
    xcopy /E /Y /I "%TEMP_DIR%\package\vendor" "%PROJECT_DIR%vendor"
    echo   Copied vendor directory
)

REM Update package.json
if exist "%TEMP_DIR%\package\package.json" (
    copy /Y "%TEMP_DIR%\package\package.json" "%PROJECT_DIR%package.json"
    echo   Updated package.json
)

echo.
echo Cleaning up temporary files...
cd /d "%PROJECT_DIR%"
rmdir /S /Q "%TEMP_DIR%"
echo   Cleanup complete

echo.
echo =============================
echo Download complete!
echo.
echo You can now build executables with:
echo   bun run scripts/build/build-executables.js windows
echo.
pause
