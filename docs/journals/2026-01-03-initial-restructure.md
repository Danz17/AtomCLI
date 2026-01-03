# 2026-01-03: AtomCLI Initial Restructure

## Summary

Complete restructure of the Claude Code single-binary project into a modular, extensible CLI build system called **AtomCLI**. The system now features a rich LazyGit-style terminal UI, dynamic runtime detection, and support for multiple CLI tools.

## Changes Made

### Structure
- [x] Created new folder structure (`core/`, `components/`, `distro/`, `docs/`)
- [x] Organized components into modular directories
- [x] Separated CLI sources into `core/` folder for multi-tool support
- [x] Created placeholder for future Codex CLI support

### Components Created

#### Utils Module (`components/utils/`)
- **colors.js** - Terminal colors with ANSI 256-color and RGB true color support
  - Basic colors (red, green, blue, yellow, etc.)
  - Styles (bold, dim, italic, underline)
  - Box-drawing characters for TUI
  - Theme colors for AtomCLI branding
  - True color RGB support

- **logger.js** - Structured logging with rich formatting
  - Log levels: DEBUG, INFO, SUCCESS, WARN, ERROR, FATAL
  - Rich formatting: headers, dividers, lists, key-value pairs
  - Progress indicators: bars and animated spinners
  - Configurable log level filtering

- **platform.js** - Platform detection and dependency checking
  - OS detection (Windows, Linux, macOS)
  - Architecture detection (x64, arm64, etc.)
  - Runtime detection (Node.js, Bun, Deno)
  - Shell detection (cmd, PowerShell, bash, zsh)
  - Dependency checking

#### Downloader Module (`components/downloader/`)
- CLI tool registry with extensible tool definitions
- NPM package fetching with version support
- GitHub release downloading
- Tarball and ZIP extraction
- Checksum verification

#### Builder Module (`components/builder/`)
- Build targets for all platforms:
  - Windows: x64, x64-modern (AVX2), x64-baseline
  - Linux: x64, x64-musl (Alpine), arm64
  - macOS: x64 (Intel), arm64 (Apple Silicon)
- Source preparation with embedded file imports
- Windows-specific patches (import.meta, POSIX shell bypass)
- Bun compilation wrapper

#### Installer Module (`components/installer/`)
- Prerequisites checking
- Bun runtime installation
- PATH configuration (Windows and Unix)
- Executable installation with shortcuts
- Shell completion scripts

### Main Application
- **atom.js** - Rich terminal UI inspired by LazyGit/Ghostty
  - Interactive menu navigation (keyboard + number keys)
  - Dynamic runtime detection at startup
  - Download, build, and platform selection views
  - System information display
  - Settings configuration

### Bootstrap Scripts
- **atom.bat** - Windows batch launcher
- **atom.ps1** - PowerShell launcher with runtime selection
- **atom.sh** - Bash launcher for Linux/macOS
- All scripts detect installed runtimes and let user choose

### Documentation
- Comprehensive README.md with API documentation
- Utils module README
- Development journal system

## Technical Notes

### Runtime Detection
The bootstrap scripts detect available JavaScript runtimes (Bun, Node.js) and present a menu if both are available. This allows users to choose their preferred runtime without manual configuration.

### Modular Architecture
Each component is self-contained with its own `index.js` that exports all public functions. Components can be used independently or through the main atom.js application.

### Build Process
The builder module uses Bun's `--compile` feature to create standalone executables. It applies platform-specific patches:
1. Windows import.meta compatibility
2. POSIX shell bypass for native cmd.exe support
3. Embedded file imports using Bun's native embedding

### TUI Design
The terminal UI uses ANSI escape codes for:
- 256-color and true color support
- Box-drawing characters for panels
- Cursor movement for screen management
- Raw input mode for keyboard navigation

## File Inventory

```
New Files Created:
├── atom.js
├── atom.bat
├── atom.ps1
├── atom.sh
├── components/
│   ├── utils/
│   │   ├── colors.js
│   │   ├── logger.js
│   │   ├── platform.js
│   │   ├── index.js
│   │   └── README.md
│   ├── downloader/
│   │   └── index.js
│   ├── builder/
│   │   └── index.js
│   └── installer/
│       └── index.js
├── core/
│   ├── claude-code/
│   └── codex/
├── distro/
│   ├── windows/
│   ├── linux/
│   └── macos/
├── docs/
│   └── journals/
│       └── 2026-01-03-initial-restructure.md
└── README.md (updated)
```

## Next Steps

1. **Move Existing Files** - Move `cli.js`, `sdk.mjs`, `vendor/` to `core/claude-code/`
2. **Test TUI** - Run `node atom.js` to verify the interactive interface
3. **Download Integration** - Test npm package downloading
4. **Build Testing** - Verify builds work on Windows
5. **Future CLI Support** - Add Codex/Cursor tool definitions when available

## Known Issues

- GitHub source downloading not fully implemented (npm works)
- Build requires Bun runtime (Node.js can run atom.js but not compile)
- Some terminal emulators may not support all ANSI features

---

*Journal Entry for AtomCLI v1.0.0 Initial Restructure*
