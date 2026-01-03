# ⚛️ AtomCLI

> **Cross-Platform CLI Build System**
> Build standalone executables for Claude Code, Codex, and other AI CLI tools.

```
   ╔═══════════════════════════════════════════════════════════╗
   ║                     ⚛️  ATOMCLI  ⚛️                        ║
   ║            Cross-Platform CLI Build System                ║
   ╚═══════════════════════════════════════════════════════════╝
```

## 🚀 Quick Start

### Windows

```batch
# Using Batch
atom.bat

# Using PowerShell
.\atom.ps1

# Force specific runtime
.\atom.ps1 -Runtime bun
```

### Linux / macOS

```bash
# Make executable
chmod +x atom.sh

# Run
./atom.sh

# Force specific runtime
./atom.sh -r bun
```

### Direct (with Node.js or Bun)

```bash
# Node.js
node atom.js

# Bun (recommended)
bun atom.js
```

## ✨ Features

- **🎨 Rich Terminal UI** - LazyGit/Ghostty-style interface with panels, colors, and keyboard navigation
- **🔄 Dynamic Runtime Detection** - Automatically detects installed runtimes (Bun, Node.js)
- **📥 Automatic Downloads** - Fetch CLI sources from npm or GitHub
- **🔨 Multi-Platform Builds** - Build for Windows, Linux, and macOS
- **🛠️ Modular Architecture** - Extensible component system
- **📦 Future CLI Support** - Designed to support Claude Code, Codex, Cursor, and more

## 📁 Project Structure

```
AtomCLI/
├── atom.js                 # Main TUI application
├── atom.bat                # Windows batch launcher
├── atom.ps1                # PowerShell launcher
├── atom.sh                 # Bash launcher (Linux/macOS)
│
├── core/                   # CLI source files
│   ├── claude-code/        # Claude Code CLI
│   │   ├── cli.js          # Main CLI bundle
│   │   ├── sdk.mjs         # SDK module
│   │   ├── sdk.d.ts        # TypeScript definitions
│   │   ├── yoga.wasm       # Layout engine
│   │   ├── package.json
│   │   └── vendor/         # Bundled tools (ripgrep, etc.)
│   │
│   └── codex/              # Future: OpenAI Codex CLI
│
├── components/             # Modular components
│   ├── downloader/         # Download from npm/GitHub
│   │   └── index.js
│   ├── builder/            # Bun compilation
│   │   └── index.js
│   ├── installer/          # Platform installers
│   │   └── index.js
│   └── utils/              # Utilities
│       ├── colors.js       # Terminal colors
│       ├── logger.js       # Structured logging
│       ├── platform.js     # Platform detection
│       └── index.js
│
├── scripts/                # Build & utility scripts
│   ├── build/              # Build scripts
│   ├── debug/              # Debug utilities
│   ├── fixes/              # Platform fixes
│   └── test/               # Test scripts
│
├── distro/                 # Built executables
│   ├── windows/
│   ├── linux/
│   └── macos/
│
└── docs/                   # Documentation
    └── journals/           # Development logs
```

## 🎮 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑`/`↓` or `j`/`k` | Navigate menu |
| `Enter` | Select item |
| `1-9` | Quick select |
| `b` | Go back |
| `?` | Show help |
| `q` | Quit |

## 🔧 Supported Build Targets

### Windows
| Target | Description |
|--------|-------------|
| `windows-x64` | Windows 64-bit |
| `windows-x64-modern` | Windows 64-bit with AVX2 |
| `windows-x64-baseline` | Windows 64-bit (older CPUs) |

### Linux
| Target | Description |
|--------|-------------|
| `linux-x64` | Linux 64-bit (glibc) |
| `linux-x64-musl` | Linux 64-bit (musl/Alpine) |
| `linux-arm64` | Linux ARM 64-bit |

### macOS
| Target | Description |
|--------|-------------|
| `macos-x64` | macOS Intel |
| `macos-arm64` | macOS Apple Silicon |

### Android / Termux
| Target | Description |
|--------|-------------|
| `android-arm64` | Android ARM64 (Termux) |

## 🐚 Shell Configuration

The compiled binary automatically detects and uses the best available shell at runtime.

### Detection Priority

**Windows:**
1. PowerShell Core (`pwsh.exe`)
2. Windows PowerShell (`powershell.exe`)
3. Command Prompt (`cmd.exe`)

**Linux/macOS:**
1. User's `SHELL` environment variable
2. Bash (`/bin/bash`)
3. Zsh (`/bin/zsh`)
4. POSIX Shell (`/bin/sh`)

**Termux (Android):**
1. Termux Bash (`/data/data/com.termux/files/usr/bin/bash`)

### Override Shell

Set the `CLAUDE_SHELL` environment variable to force a specific shell:

```bash
# Windows (PowerShell)
$env:CLAUDE_SHELL = "pwsh.exe"
./claude-code.exe

# Windows (CMD)
set CLAUDE_SHELL=cmd.exe
claude-code.exe

# Linux/macOS
CLAUDE_SHELL=/bin/zsh ./claude-code

# Termux
CLAUDE_SHELL=/data/data/com.termux/files/usr/bin/zsh ./claude-code
```

## 🧪 Testing

### Run Unit Tests

```bash
# Unit tests only (fast)
node scripts/test/test-builder.cjs

# With integration tests (builds executable)
node scripts/test/test-builder.cjs --build
```

### Test Output

```
══════════════════════════════════════════════════════════════════════
  ATOMCLI BUILDER TESTS
══════════════════════════════════════════════════════════════════════

▶ Builder Module Loading
  ✓ Builder module loads successfully
  ✓ BUILD_TARGETS is exported
  ...

▶ BUILD_TARGETS Configuration
  ✓ Target 'windows-x64' exists
  ✓ Target 'android-arm64' exists
  ...

Summary:
  Passed:  42
  Failed:  0
  Skipped: 2

All tests passed!
```

## 📦 Prerequisites

### Required
- **Bun** - For compiling executables ([bun.sh](https://bun.sh))
- **Git** - For source management

### Optional
- **Node.js** - Alternative runtime for running AtomCLI
- **npm/yarn/pnpm** - Package managers

## 🏗️ Building Executables

### Interactive Mode

1. Launch AtomCLI: `bun atom.js`
2. Select **[1] Download Source** to fetch CLI from npm
3. Select **[2] Build Executables** or **[4] Platform Builds**
4. Find your executable in `distro/` folder

### Programmatic Usage

```javascript
const downloader = require('./components/downloader');
const builder = require('./components/builder');

// Download Claude Code
await downloader.downloadTool('claude-code', './core/claude-code');

// Build for Windows
await builder.buildTarget('windows-x64', './core/claude-code/package', './distro');
```

## 🔨 Component API

### Downloader

```javascript
const { downloadTool, getNpmPackageInfo } = require('./components/downloader');

// Download CLI tool
const result = await downloadTool('claude-code', './output', {
  source: 'npm',        // 'npm' or 'github'
  version: 'latest',    // specific version
  onProgress: (received, total, percent) => { ... },
  onStatus: (message) => { ... },
});

// Get package info
const info = await getNpmPackageInfo('@anthropic-ai/claude-code');
```

### Builder

```javascript
const { buildTarget, buildPlatform, BUILD_TARGETS } = require('./components/builder');

// Build for specific target
const result = await buildTarget('windows-x64', sourceDir, outputDir, {
  onStatus: (message) => { ... },
});

// Build for all platforms in a category
await buildPlatform('windows', sourceDir, outputDir);
```

### Installer

```javascript
const { installBun, installExecutable, checkPrerequisites } = require('./components/installer');

// Check prerequisites
const prereqs = checkPrerequisites();
console.log('Can build:', prereqs.canBuild);

// Install Bun runtime
await installBun({ onStatus: console.log });

// Install built executable
await installExecutable('./distro/windows/claude.exe', 'claude');
```

### Utils

```javascript
const { colors, log, platform } = require('./components/utils');

// Colors
console.log(colors.green('Success!'));
console.log(colors.bold(colors.red('Error!')));

// Logging
log.info('Processing...');
log.success('Done!');
log.header('Build Started');

// Platform detection
const info = platform.detect();
console.log(info.os, info.arch);
```

## 🐛 Troubleshooting

### "Bun not found"
Install Bun: `curl -fsSL https://bun.sh/install | bash` (Unix) or `irm bun.sh/install.ps1 | iex` (Windows)

### Build fails with "import.meta" error
The builder automatically patches import.meta for Windows compatibility. Ensure you're using the latest builder module.

### Terminal colors not showing
On Windows, ensure you're using Windows Terminal or a terminal with ANSI support. Run: `Set-ItemProperty HKCU:\Console VirtualTerminalLevel -Type DWORD 1`

### Permission denied
- Windows: Run as Administrator
- Linux/macOS: Use `sudo` or install to user directory

## 📄 License

This project builds CLI tools that have their own licenses:
- **Claude Code**: See [Claude_Code_LICENSE.md](Claude_Code_LICENSE.md)
- **AtomCLI Build System**: MIT License

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for detailed guidelines.

## 📚 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Build Guide](docs/BUILD-GUIDE.md)
- [Development Guidelines](docs/DEVELOPMENT.md)
- [Development Journals](docs/journals/)

---

**AtomCLI** - Building the future of AI CLI tools, one executable at a time. ⚛️
