# Utils Module

> Core utility functions for AtomCLI

## Overview

The utils module provides foundational functionality used throughout AtomCLI:

- **colors.js** - Terminal colors, styles, and box-drawing characters
- **logger.js** - Structured logging with levels, formatting, and progress indicators
- **platform.js** - Platform detection and dependency checking

## Usage

```javascript
const { colors, log, platform } = require('./components/utils');

// Colors
console.log(colors.green('Success!'));
console.log(colors.bold(colors.red('Error!')));

// Logging
log.info('Starting build...');
log.success('Build complete!');
log.error('Build failed', { code: 1 });

// Platform detection
const info = platform.detect();
console.log(`Running on ${info.os} ${info.arch}`);

const deps = platform.checkDependencies();
console.log('Available runtimes:', deps.optional.filter(d => d.available));
```

## API Reference

### colors.js

| Function | Description |
|----------|-------------|
| `colors.red(text)` | Red text |
| `colors.green(text)` | Green text |
| `colors.blue(text)` | Blue text |
| `colors.yellow(text)` | Yellow text |
| `colors.bold(text)` | Bold text |
| `rgb(r, g, b)(text)` | True color (24-bit) |
| `theme.primary(text)` | Brand primary color |
| `box.topLeft` | Box drawing character |

### logger.js

| Function | Description |
|----------|-------------|
| `log.debug(msg)` | Debug level message |
| `log.info(msg)` | Info level message |
| `log.success(msg)` | Success message with checkmark |
| `log.warn(msg)` | Warning message |
| `log.error(msg)` | Error message |
| `log.header(title)` | Section header box |
| `log.progressBar(cur, total)` | Progress bar string |
| `log.spinner(msg)` | Animated spinner |

### platform.js

| Function | Description |
|----------|-------------|
| `platform.detect()` | Full platform info object |
| `platform.detectOS()` | OS name (windows/linux/macos) |
| `platform.detectArch()` | Architecture (x64/arm64) |
| `platform.detectRuntimes()` | Available JS runtimes |
| `platform.checkDependencies()` | Check all dependencies |
| `platform.commandExists(cmd)` | Check if command exists |
| `platform.getBuildTarget()` | Bun build target string |

## File Structure

```
components/utils/
├── index.js       # Main export file
├── colors.js      # Color utilities
├── logger.js      # Logging utilities
├── platform.js    # Platform detection
└── README.md      # This file
```
