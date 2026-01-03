# Multi-CLI Build Testing
**Date:** 2026-01-03
**Status:** Complete

## Summary

Tested AtomCLI's ability to build multiple AI coding CLI tools as standalone executables. Results show strong compatibility with JavaScript-based CLIs and native Rust binaries.

## Build Results

| CLI Tool | Build Status | Size | Notes |
|----------|--------------|------|-------|
| Claude Code | Working | 110.4 MB | Bun-compiled from npm package |
| OpenAI Codex | Working | 57.5 MB | Pre-built Rust binary (vendor) |
| Universal Launcher | Working | 110.4 MB | Bun-compiled launcher app |
| GitHub Copilot | Build OK, Runtime Error | 118.6 MB | React minification issue |
| Google Gemini | Failed | - | External dependencies not bundled |

## Detailed Analysis

### Claude Code (Working)
- **Source:** `@anthropic-ai/claude-code` from npm
- **Entry Point:** `cli.js`
- **Build Method:** Bun `--compile` with Windows compatibility patches
- **Result:** Fully functional standalone executable

### OpenAI Codex (Working)
- **Source:** `@openai/codex` from npm
- **Architecture:** Rust-based CLI with pre-built native binaries
- **Build Method:** Direct copy from `vendor/x86_64-pc-windows-msvc/codex/`
- **Version:** 0.77.0
- **Result:** Native Windows executable, no compilation needed

### Universal Launcher (Working)
- **Source:** Local `components/launcher/`
- **Entry Point:** `launcher-cli.js`
- **Build Method:** Bun `--compile`
- **Result:** Interactive launcher for multiple CLI tools

### GitHub Copilot (Partial)
- **Source:** `@githubnext/github-copilot-cli` from npm
- **Entry Point:** `dist/index.js`
- **Issue:** `ReferenceError: _a is not defined` at runtime
- **Cause:** Minified React code conflicts with Bun's patching
- **Status:** Builds but fails at runtime

### Google Gemini (Failed)
- **Source:** `@google/gemini-cli` from npm
- **Entry Point:** `dist/index.js`
- **Issue:** `Could not resolve: "@google/gemini-cli-core"`
- **Cause:** ESM package with external dependencies not bundled
- **Status:** Requires full monorepo build, not npm standalone

## CLI Registry Updates

Updated `components/downloader/index.js` with correct entries:

```javascript
// Fixed entries
'gemini': {
  npm: '@google/gemini-cli',  // Correct package name
  build: { entryPoint: 'dist/index.js' }
},

'copilot': {
  npm: '@githubnext/github-copilot-cli',
  build: { entryPoint: 'dist/index.js' }  // Fixed from cli.js
},

'cody': {
  npm: '@sourcegraph/cody-cli',
  build: { entryPoint: 'cli.js' }
}
```

## Lessons Learned

1. **Rust CLIs** often ship pre-built binaries - no Bun compilation needed
2. **ESM packages** with external dependencies require special handling
3. **React-based CLIs** may have minification conflicts with Bun
4. **JavaScript CLIs** with bundled dependencies work best

## Recommendations

For future CLI additions:
1. Check if package includes pre-built native binaries
2. Verify all dependencies are bundled (not external)
3. Test for React/minification compatibility
4. Consider using source build for complex packages

## Output Directory

```
distro/windows/
├── claude-code-windows-x64.exe     (110.4 MB) - Working
├── codex-windows-x64.exe           (57.5 MB)  - Working
├── launcher-windows-x64.exe        (110.4 MB) - Working
├── copilot-windows-x64.exe         (118.6 MB) - Runtime error
├── codex-command-runner.exe        (Helper binary)
├── codex-windows-sandbox-setup.exe (Helper binary)
└── rg.exe                          (Ripgrep for Claude)
```

## Next Steps

- [ ] Investigate Copilot runtime error (React patching)
- [ ] Build Gemini from source repository
- [ ] Test Cody CLI compatibility
- [ ] Add Linux/macOS build testing
