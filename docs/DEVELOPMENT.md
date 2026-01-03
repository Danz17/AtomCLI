# AtomCLI Development Guidelines

> Standards and conventions for contributing to AtomCLI

## Code Style

### Indentation
- Use **2 spaces** for indentation (never tabs)
- Maximum line length: **100 characters** (wrap at 80 when possible)

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Local variables | camelCase | `buildTarget`, `sourceDir` |
| Constants | UPPER_SNAKE_CASE | `BUILD_TARGETS`, `MAX_RETRIES` |
| Functions | camelCase | `getCurrentTarget()`, `findBunPath()` |
| Classes | PascalCase | `BuildManager`, `DownloadQueue` |
| Files | kebab-case or camelCase | `test-builder.cjs`, `platform.js` |

## Code Commenting Standards

### Module Header Block

Every module should start with a descriptive header:

```javascript
/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                          MODULE NAME                                         ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Brief description of what this module does                                  ║
 * ║                                                                              ║
 * ║  Key Features:                                                               ║
 * ║  - Feature 1                                                                 ║
 * ║  - Feature 2                                                                 ║
 * ║                                                                              ║
 * ║  Usage:                                                                      ║
 * ║    const module = require('./module');                                       ║
 * ║    await module.doSomething();                                               ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
```

### Section Dividers

Use section dividers to organize code logically:

```javascript
// ═══════════════════════════════════════════════════════════════════════════════
// SECTION NAME
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose: What this section does
//
// Key Functions:
//   - functionName() - brief description
//   - anotherFunc() - brief description
//
// Notes:
//   - Important consideration 1
//   - Important consideration 2
// ═══════════════════════════════════════════════════════════════════════════════
```

### Function Documentation (JSDoc)

All exported functions must have JSDoc comments:

```javascript
/**
 * Brief description of what the function does
 *
 * Longer description if needed, explaining:
 * - How it works
 * - Edge cases
 * - Important behavior
 *
 * @param {string} param1 - Description of param1
 * @param {Object} [options] - Optional configuration
 * @param {boolean} [options.force=false] - Force operation
 * @param {Function} [options.onStatus] - Status callback
 * @returns {Promise<Object>} - Description of return value
 * @throws {Error} - When param1 is invalid
 *
 * @example
 * // Basic usage
 * const result = await functionName('value');
 *
 * @example
 * // With options
 * const result = await functionName('value', {
 *   force: true,
 *   onStatus: (msg) => console.log(msg)
 * });
 */
function functionName(param1, options = {}) {
  // Implementation
}
```

### Inline Comments

Use inline comments for complex logic:

```javascript
// Calculate the offset based on page size
// Formula: (pageNumber - 1) * pageSize
// Note: Pages are 1-indexed, not 0-indexed
const offset = (page - 1) * PAGE_SIZE;

// Check if user has permission (admin or owner)
// The bitwise AND checks for admin flag (0x01)
if ((user.flags & 0x01) || user.id === resource.ownerId) {
  // Allowed
}
```

## Module Structure

### Standard Module Layout

```javascript
/**
 * Module header block
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORTS
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // ...
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS (private)
// ═══════════════════════════════════════════════════════════════════════════════

function helperFunction() {
  // ...
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN FUNCTIONS (public)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Main exported function
 */
async function mainFunction() {
  // ...
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  mainFunction,
  CONFIG,
};
```

## Testing Requirements

### Test File Naming
- Test files: `test-*.cjs` or `*.test.cjs`
- Location: `scripts/test/`

### Test Structure

```javascript
/**
 * Test suite header
 */

'use strict';

// Test configuration
const ROOT_DIR = path.resolve(__dirname, '../..');

// Test helpers
function assert(condition, message) { /* ... */ }
function section(title) { /* ... */ }

// ═══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS
// ═══════════════════════════════════════════════════════════════════════════════

function testModuleLoading() {
  section('Module Loading');
  // Tests...
}

function testConfiguration() {
  section('Configuration');
  // Tests...
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

async function testBuildProcess() {
  section('Build Process');
  // Tests...
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

async function runTests() {
  // Run unit tests
  testModuleLoading();
  testConfiguration();

  // Run integration tests if requested
  if (process.argv.includes('--build')) {
    await testBuildProcess();
  }

  // Print summary
}

runTests();
```

## Git Commit Messages

### Format
```
Type: Short description (max 50 chars)

Longer description if needed (wrap at 72 chars)
- Bullet points for multiple changes
- Another change

Refs: #123, #456
```

### Types
| Type | Description |
|------|-------------|
| `Add` | New features, files, or functionality |
| `Fix` | Bug fixes |
| `Update` | Changes to existing features |
| `Remove` | Removing features or files |
| `Refactor` | Code restructuring without behavior change |
| `Docs` | Documentation changes only |
| `Test` | Adding or updating tests |

### Examples
```
Add: Android/Termux build target

- Added android-arm64 target using linux-arm64 base
- Shell defaults to Termux bash path
- Updated getTargetsForPlatform() to include android

Refs: shell-config
```

## Error Handling

### Always Handle Errors Explicitly

```javascript
// Good
try {
  const result = await riskyOperation();
  return result;
} catch (err) {
  log.error(`Operation failed: ${err.message}`);
  throw new Error(`Failed to complete operation: ${err.message}`);
}

// Bad - silent failure
try {
  await riskyOperation();
} catch (err) {
  // Silent fail - DON'T DO THIS
}
```

### Provide Context in Errors

```javascript
// Good
throw new Error(`Failed to build target '${targetId}': ${err.message}`);

// Bad
throw new Error('Build failed');
```

## Security Guidelines

### Never Commit Secrets
- Use `.env` files for sensitive configuration
- Add `.env` to `.gitignore`
- Use environment variables at runtime

### Validate External Input
```javascript
// Validate user input before using in paths
const sanitizedName = name.replace(/[^a-zA-Z0-9-_]/g, '');
const safePath = path.join(baseDir, sanitizedName);

// Ensure path doesn't escape base directory
if (!safePath.startsWith(path.resolve(baseDir))) {
  throw new Error('Invalid path: attempted path traversal');
}
```

## File Organization

```
AtomCLI/
├── atom.js                 # Entry point - keep minimal
├── components/             # Modular functionality
│   ├── module/
│   │   ├── index.js        # Main exports
│   │   └── helpers.js      # Internal helpers (optional)
│   └── package.json        # Module type declaration
├── scripts/
│   └── test/               # Test files
├── docs/
│   ├── journals/           # Development logs
│   └── *.md                # Documentation
└── distro/                 # Build output (gitignored)
```

## Pull Request Checklist

Before submitting a PR, ensure:

- [ ] Code follows naming conventions
- [ ] All functions have JSDoc comments
- [ ] Section dividers used for organization
- [ ] Tests added/updated for changes
- [ ] Tests pass: `node scripts/test/test-builder.cjs`
- [ ] README updated if needed
- [ ] Journal entry created for significant changes
- [ ] No secrets or credentials committed
- [ ] Commit messages follow format

---

*Last updated: 2026-01-03*
