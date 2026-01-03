/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                          ATOMCLI - BUILDER MODULE                            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Compiles CLI tools into standalone executables                              ║
 * ║                                                                              ║
 * ║  Supported Platforms:                                                        ║
 * ║  - Windows (x64, x64-modern, x64-baseline)                                   ║
 * ║  - Linux (x64, arm64, musl variants)                                         ║
 * ║  - macOS (x64, arm64)                                                        ║
 * ║  - Android (arm64 / Termux)                                                  ║
 * ║                                                                              ║
 * ║  Build Process:                                                              ║
 * ║  1. Prepare source (apply patches)                                           ║
 * ║  2. Embed assets (yoga.wasm, ripgrep)                                        ║
 * ║  3. Compile with Bun                                                         ║
 * ║  4. Output to distro folder                                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD TARGETS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose: Define all supported compilation targets for Bun
//
// Each target specifies:
//   - target: Bun's --target flag value (e.g., 'bun-windows-x64')
//   - output: Output filename for the compiled binary
//   - platform: Target OS ('windows', 'linux', 'macos', 'android')
//   - arch: CPU architecture ('x64', 'arm64')
//   - variant: Build variant ('standard', 'modern', 'baseline', 'musl', 'termux')
//
// Usage:
//   const target = BUILD_TARGETS['windows-x64'];
//   await buildTarget('windows-x64', sourceDir, outputDir);
//
// Notes:
//   - 'modern' variants require AVX2 CPU support (faster but less compatible)
//   - 'baseline' variants work on older CPUs (SSE2 only)
//   - 'musl' variants are for Alpine Linux / static linking
//   - Android uses Linux ARM64 base with Termux shell paths
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build targets configuration
 *
 * Maps target IDs to their Bun compilation settings. Each target defines
 * the exact parameters needed to compile a standalone executable for that
 * platform/architecture combination.
 *
 * @type {Object.<string, {target: string, output: string, platform: string, arch: string, variant: string}>}
 */
// ─────────────────────────────────────────────────────────────────────────────
// BUILD TARGET TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────
//
// These templates define the platform/arch configurations WITHOUT hardcoded
// output names. Use generateBuildTargets() to create tool-specific targets.
//
// Fields:
//   - target: Bun's --target flag value
//   - platform: OS name (windows, linux, macos, android)
//   - arch: CPU architecture (x64, arm64)
//   - variant: Build variant (standard, modern, baseline, musl, termux)
//   - extension: File extension (.exe for Windows, empty for Unix)
// ─────────────────────────────────────────────────────────────────────────────

const BUILD_TARGET_TEMPLATES = {
  // Windows
  'windows-x64': {
    target: 'bun-windows-x64',
    platform: 'windows',
    arch: 'x64',
    variant: 'standard',
    extension: '.exe',
  },
  'windows-x64-modern': {
    target: 'bun-windows-x64-modern',
    platform: 'windows',
    arch: 'x64',
    variant: 'modern',
    extension: '.exe',
    requires: 'AVX2 (CPUs from 2013+)',
  },
  'windows-x64-baseline': {
    target: 'bun-windows-x64-baseline',
    platform: 'windows',
    arch: 'x64',
    variant: 'baseline',
    extension: '.exe',
    requires: 'SSE2 (CPUs from 2003+)',
  },

  // Linux glibc
  'linux-x64': {
    target: 'bun-linux-x64',
    platform: 'linux',
    arch: 'x64',
    variant: 'standard',
    extension: '',
  },
  'linux-x64-modern': {
    target: 'bun-linux-x64-modern',
    platform: 'linux',
    arch: 'x64',
    variant: 'modern',
    extension: '',
  },
  'linux-x64-baseline': {
    target: 'bun-linux-x64-baseline',
    platform: 'linux',
    arch: 'x64',
    variant: 'baseline',
    extension: '',
  },
  'linux-arm64': {
    target: 'bun-linux-arm64',
    platform: 'linux',
    arch: 'arm64',
    variant: 'standard',
    extension: '',
  },

  // Linux musl (Alpine)
  'linux-x64-musl': {
    target: 'bun-linux-x64-musl',
    platform: 'linux',
    arch: 'x64',
    variant: 'musl',
    extension: '',
    libc: 'musl',
  },
  'linux-arm64-musl': {
    target: 'bun-linux-arm64-musl',
    platform: 'linux',
    arch: 'arm64',
    variant: 'musl',
    extension: '',
    libc: 'musl',
  },

  // macOS
  'macos-x64': {
    target: 'bun-darwin-x64',
    platform: 'macos',
    arch: 'x64',
    variant: 'standard',
    extension: '',
  },
  'macos-arm64': {
    target: 'bun-darwin-arm64',
    platform: 'macos',
    arch: 'arm64',
    variant: 'standard',
    extension: '',
  },

  // Android / Termux
  'android-arm64': {
    target: 'bun-linux-arm64',
    platform: 'android',
    arch: 'arm64',
    variant: 'termux',
    extension: '',
    shell: '/data/data/com.termux/files/usr/bin/bash',
    description: 'Android ARM64 (Termux)',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC BUILD TARGET GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate tool-specific build targets from templates
 *
 * Creates BUILD_TARGETS with tool-specific output names.
 * Example: generateBuildTargets('codex', { build: { binaryName: 'codex' } })
 * produces targets with outputs like 'codex-windows-x64.exe', 'codex-linux-arm64', etc.
 *
 * @param {string} toolId - Tool ID (e.g., 'claude-code', 'codex', 'gemini')
 * @param {Object} toolConfig - Tool configuration from CLI_REGISTRY
 * @returns {Object} - Tool-specific BUILD_TARGETS object
 */
function generateBuildTargets(toolId, toolConfig = {}) {
  const binaryName = toolConfig?.build?.binaryName || toolId;
  const targets = {};

  for (const [id, template] of Object.entries(BUILD_TARGET_TEMPLATES)) {
    targets[id] = {
      ...template,
      output: `${binaryName}-${id}${template.extension || ''}`,
    };
  }

  return targets;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT BUILD TARGETS (Claude Code - backwards compatibility)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default build targets for Claude Code
 *
 * This maintains backwards compatibility with existing code that uses
 * BUILD_TARGETS directly. For multi-CLI support, use generateBuildTargets().
 */
const BUILD_TARGETS = generateBuildTargets('claude-code', {
  build: { binaryName: 'claude-code' }
});

/**
 * Get targets for a platform
 * @param {string} platform - 'windows', 'linux', 'macos', or 'android'
 * @returns {Object}
 */
function getTargetsForPlatform(platform) {
  return Object.fromEntries(
    Object.entries(BUILD_TARGETS).filter(([, config]) => config.platform === platform)
  );
}

/**
 * Get current platform target
 * @returns {string}
 */
function getCurrentTarget() {
  const platform = process.platform === 'win32' ? 'windows'
    : process.platform === 'darwin' ? 'macos'
    : 'linux';
  const arch = process.arch;

  return Object.entries(BUILD_TARGETS).find(
    ([, config]) => config.platform === platform && config.arch === arch && config.variant === 'standard'
  )?.[0] || 'linux-x64';
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUN RUNTIME DETECTION
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose: Locate and validate Bun installation
//
// Key Functions:
//   - findBunPath() - Search for Bun executable in common locations
//   - hasBun() - Check if Bun is available
//   - getBunVersion() - Get installed Bun version string
//
// Search Order (Windows):
//   1. PATH (bun, bun.exe)
//   2. User install: %USERPROFILE%\.bun\bin\bun.exe
//   3. Local install: %LOCALAPPDATA%\bun\bun.exe
//
// Search Order (Unix):
//   1. PATH (bun)
//   2. User install: ~/.bun/bin/bun
//   3. System: /usr/local/bin/bun, /usr/bin/bun
//
// Notes:
//   - Bun is REQUIRED for compilation (--compile flag)
//   - Node.js can run AtomCLI but cannot compile executables
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Find Bun executable path
 *
 * Searches common installation locations for Bun. Returns the first
 * working path found, or null if Bun is not installed.
 *
 * @returns {string|null} Path to Bun executable, or null if not found
 */
function findBunPath() {
  // Check common locations
  const isWindows = process.platform === 'win32';
  const home = process.env.USERPROFILE || process.env.HOME || '';

  // Get the AtomCLI root directory (parent of components)
  const atomcliRoot = path.resolve(__dirname, '..', '..');

  const possiblePaths = isWindows ? [
    // Local AtomCLI tools directory first
    path.join(atomcliRoot, 'tools', 'bun', 'bun-windows-x64', 'bun.exe'),
    path.join(atomcliRoot, 'tools', 'bun', 'bun.exe'),
    'bun',
    'bun.exe',
    path.join(home, '.bun', 'bin', 'bun.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'bun', 'bun.exe'),
  ] : [
    // Local AtomCLI tools directory first
    path.join(atomcliRoot, 'tools', 'bun', 'bun-linux-x64', 'bun'),
    path.join(atomcliRoot, 'tools', 'bun', 'bun'),
    'bun',
    path.join(home, '.bun', 'bin', 'bun'),
    '/usr/local/bin/bun',
    '/usr/bin/bun',
  ];

  for (const bunPath of possiblePaths) {
    try {
      execSync(`"${bunPath}" --version`, { stdio: 'pipe' });
      return bunPath;
    } catch {
      // Continue to next path
    }
  }
  return null;
}

/**
 * Check if Bun is available
 * @returns {boolean}
 */
function hasBun() {
  return findBunPath() !== null;
}

/**
 * Get Bun version
 * @returns {string|null}
 */
function getBunVersion() {
  const bunPath = findBunPath();
  if (!bunPath) return null;
  try {
    return execSync(`"${bunPath}" --version`, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/**
 * Prepare CLI source for building
 *
 * Applies patches and embeds assets for the specified CLI tool.
 * Supports multiple CLI tools with different entry points and configurations.
 *
 * @param {string} sourceDir - Source directory (e.g., core/claude-code/package)
 * @param {string} targetPlatform - Target platform (windows, linux, macos, android)
 * @param {Object} [options]
 * @param {Function} [options.onStatus] - Status callback
 * @param {Object} [options.toolConfig] - Tool configuration from CLI_REGISTRY
 * @returns {Promise<string>} - Path to prepared source file
 */
async function prepareSource(sourceDir, targetPlatform, options = {}) {
  const { onStatus, toolConfig } = options;

  // Use tool-specific entry point or default to cli.js
  const entryPoint = toolConfig?.build?.entryPoint || 'cli.js';
  const cliPath = path.join(sourceDir, entryPoint);

  if (!fs.existsSync(cliPath)) {
    throw new Error(`CLI source not found at ${cliPath}`);
  }

  onStatus?.(`Reading CLI source (${entryPoint})...`);
  let cliContent = fs.readFileSync(cliPath, 'utf-8');

  // Apply embedded file imports
  onStatus?.('Adding embedded file imports...');
  cliContent = addEmbeddedImports(cliContent, sourceDir);

  // Apply platform-specific patches (pass toolConfig for dynamic values)
  if (targetPlatform === 'windows') {
    onStatus?.('Applying Windows-specific patches...');
    cliContent = applyWindowsPatches(cliContent, toolConfig);
  }

  // Apply common patches (pass toolConfig for dynamic env prefix)
  onStatus?.('Applying common patches...');
  cliContent = applyCommonPatches(cliContent, toolConfig);

  // Write prepared source (use entry point name for prepared file)
  const baseName = path.basename(entryPoint, '.js');
  const preparedPath = path.join(sourceDir, targetPlatform === 'windows'
    ? `${baseName}-windows-prepared.js`
    : `${baseName}-prepared.js`
  );
  fs.writeFileSync(preparedPath, cliContent);

  onStatus?.(`Prepared source written to ${preparedPath}`);
  return preparedPath;
}

/**
 * Add embedded file imports for Bun bundling
 * @param {string} content - CLI source content
 * @param {string} sourceDir - Source directory
 * @returns {string}
 */
function addEmbeddedImports(content, sourceDir) {
  const embeddedImports = [];
  const embeddedFilesMapping = [];

  // Check for yoga.wasm
  if (fs.existsSync(path.join(sourceDir, 'yoga.wasm'))) {
    embeddedImports.push('import __embeddedYogaWasm from "./yoga.wasm" with { type: "file" };');
    embeddedFilesMapping.push("  'yoga.wasm': __embeddedYogaWasm,");
  }

  // Check for ripgrep binaries
  const ripgrepFiles = [
    { path: 'vendor/ripgrep/arm64-darwin/rg', var: '__embeddedRgDarwinArm64' },
    { path: 'vendor/ripgrep/arm64-linux/rg', var: '__embeddedRgLinuxArm64' },
    { path: 'vendor/ripgrep/x64-darwin/rg', var: '__embeddedRgDarwinX64' },
    { path: 'vendor/ripgrep/x64-linux/rg', var: '__embeddedRgLinuxX64' },
    { path: 'vendor/ripgrep/x64-win32/rg.exe', var: '__embeddedRgWin32' },
  ];

  for (const file of ripgrepFiles) {
    if (fs.existsSync(path.join(sourceDir, file.path))) {
      embeddedImports.push(`import ${file.var} from "./${file.path}" with { type: "file" };`);
      embeddedFilesMapping.push(`  '${file.path}': ${file.var},`);
    }
  }

  const embeddedCode = `
// ═══════════════════════════════════════════════════════════════════════════
// ATOMCLI EMBEDDED FILES
// Generated by AtomCLI Builder
// ═══════════════════════════════════════════════════════════════════════════

${embeddedImports.join('\n')}

const __embeddedFiles = {
${embeddedFilesMapping.join('\n')}
};

function __getSafePlatform() {
  try {
    const p = typeof process !== 'undefined' ? process : {};
    return { arch: (p.arch || 'x64').toString(), platform: (p.platform || 'linux').toString() };
  } catch (e) {
    return { arch: 'x64', platform: 'linux' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════

`;

  // Insert after shebang
  const shebangMatch = content.match(/^#!.*\n/);
  if (shebangMatch) {
    return shebangMatch[0] + embeddedCode + content.substring(shebangMatch[0].length);
  }
  return embeddedCode + content;
}

/**
 * Apply Windows-specific patches
 *
 * Adds Windows compatibility layer and tool-specific markers.
 * Uses dynamic binary name and environment variable prefix from toolConfig.
 *
 * @param {string} content - CLI source content
 * @param {Object} [toolConfig] - Tool configuration from CLI_REGISTRY
 * @returns {string} - Patched content
 */
function applyWindowsPatches(content, toolConfig = {}) {
  // Extract tool-specific values with defaults
  const binaryName = toolConfig?.build?.binaryName || 'cli-tool';
  const envPrefix = toolConfig?.build?.envPrefix || 'CLI_TOOL';

  // Add Windows compatibility header with dynamic binary name
  const windowsHeader = `
// ═══════════════════════════════════════════════════════════════════════════
// WINDOWS COMPATIBILITY LAYER
// ═══════════════════════════════════════════════════════════════════════════

let __executablePath;
if (process.argv[1]) {
  const path = require('path');
  __executablePath = path.isAbsolute(process.argv[1]) ? process.argv[1] : path.resolve(process.argv[1]);
} else {
  __executablePath = require('path').join(process.cwd(), '${binaryName}.exe');
}

const __filename = __executablePath;
const __dirname = require('path').dirname(__executablePath);

function __toFileURL(filePath) {
  const resolved = require('path').resolve(filePath);
  if (process.platform === 'win32') {
    return 'file:///' + resolved.replace(/\\\\/g, '/');
  }
  return 'file://' + resolved;
}

// ═══════════════════════════════════════════════════════════════════════════

`;

  // Insert header
  const shebangMatch = content.match(/^#!.*\n/);
  if (shebangMatch) {
    content = shebangMatch[0] + windowsHeader + content.substring(shebangMatch[0].length);
  } else {
    content = windowsHeader + content;
  }

  // Replace import.meta.url
  content = content.replace(/import\.meta\.url/g, '__toFileURL(__filename)');

  // Convert POSIX commands to Windows
  content = content
    .replace(/"\/dev\/null"/g, '"NUL"')
    .replace(/source \$\{(\w+)\}/g, 'REM source ${$1}')
    .replace(/eval \$\{(\w+)\}/g, '${$1}');

  // Mark as Windows build with tool-specific env prefix
  // Try the tool-specific pattern first, then fallback to common patterns
  const entrypointPatterns = [
    new RegExp(`process\\.env\\.${envPrefix}_ENTRYPOINT="cli"`),
    /process\.env\.CLAUDE_CODE_ENTRYPOINT="cli"/,
    /process\.env\.\w+_ENTRYPOINT="cli"/,
  ];

  for (const pattern of entrypointPatterns) {
    if (pattern.test(content)) {
      content = content.replace(
        pattern,
        `process.env.${envPrefix}_ENTRYPOINT="cli";process.env.${envPrefix}_WINDOWS_EXECUTABLE="1"`
      );
      break;
    }
  }

  return content;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUNTIME SHELL DETECTION
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose: Inject shell detection code into compiled binary
//
// This code runs AT RUNTIME in the compiled executable, not at build time.
// It determines which shell to use for spawning processes based on:
//
// Detection Priority:
//   1. CLAUDE_SHELL environment variable (user override)
//   2. Platform-specific detection:
//      - Windows: pwsh.exe > powershell.exe > cmd.exe
//      - Termux: /data/data/com.termux/files/usr/bin/bash
//      - Unix: SHELL env > /bin/bash > /bin/zsh > /bin/sh
//
// Usage (in compiled binary):
//   const shell = __atomcli_detectShell();
//   spawn(shell, ['-c', 'some command']);
//
// User Override:
//   CLAUDE_SHELL=/bin/zsh ./claude-code
//   set CLAUDE_SHELL=pwsh.exe && claude-code.exe
//
// Notes:
//   - Uses ES5 syntax for maximum compatibility
//   - IIFE pattern to avoid polluting global scope
//   - Synchronous detection (runs once at startup)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Runtime shell detection code injected into compiled binary
 *
 * This code block is inserted at the beginning of the CLI source during
 * build. It creates a __atomcli_detectShell() function that the patched
 * shell bypass code calls to find the best available shell.
 *
 * @type {string}
 */
const SHELL_DETECTION_CODE = `
// ATOMCLI: Runtime Shell Detection
var __atomcli_detectShell = (function() {
  var fs = require('fs');
  var cp = require('child_process');
  return function() {
    var env = process.env;
    // User preference via env var takes priority
    if (env.CLAUDE_SHELL) return env.CLAUDE_SHELL;
    if (process.platform === 'win32') {
      // Windows: PowerShell Core > PowerShell > cmd
      var winShells = ['pwsh.exe', 'powershell.exe', 'cmd.exe'];
      for (var i = 0; i < winShells.length; i++) {
        try { cp.execSync('where ' + winShells[i], {stdio:'pipe'}); return winShells[i]; } catch(e) {}
      }
      return 'cmd.exe';
    } else {
      // Termux detection first
      if (fs.existsSync('/data/data/com.termux/files/usr/bin/bash')) {
        return '/data/data/com.termux/files/usr/bin/bash';
      }
      // Unix: check SHELL env
      if (env.SHELL && fs.existsSync(env.SHELL)) return env.SHELL;
      // Fallback: try common shells
      var unixShells = ['/bin/bash', '/bin/zsh', '/bin/sh'];
      for (var j = 0; j < unixShells.length; j++) {
        if (fs.existsSync(unixShells[j])) return unixShells[j];
      }
      return '/bin/sh';
    }
  };
})();
`;

/**
 * Apply common patches (all platforms)
 *
 * Adds bundled marker and shell detection code.
 * Uses dynamic environment variable prefix from toolConfig.
 *
 * @param {string} content - CLI source content
 * @param {Object} [toolConfig] - Tool configuration from CLI_REGISTRY
 * @returns {string} - Patched content
 */
function applyCommonPatches(content, toolConfig = {}) {
  // Extract tool-specific env prefix with default
  const envPrefix = toolConfig?.build?.envPrefix || 'CLI_TOOL';

  // Strip shebang if present (not needed for compiled binaries)
  // Shebang is: #! followed by anything until newline
  const shebangMatch = content.match(/^#![^\n]*\n/);
  if (shebangMatch) {
    content = content.slice(shebangMatch[0].length);
  }

  // Mark as bundled with tool-specific env prefix
  // Try tool-specific pattern first, then fallback to common patterns
  const entrypointPatterns = [
    new RegExp(`process\\.env\\.${envPrefix}_ENTRYPOINT="cli"`),
    /process\.env\.CLAUDE_CODE_ENTRYPOINT="cli"/,
    /process\.env\.\w+_ENTRYPOINT="cli"/,
  ];

  for (const pattern of entrypointPatterns) {
    if (pattern.test(content)) {
      content = content.replace(
        pattern,
        `process.env.${envPrefix}_ENTRYPOINT="cli";process.env.${envPrefix}_BUNDLED="1"`
      );
      break;
    }
  }

  // Inject shell detection code at the start (after any 'use strict' if present)
  const strictMatch = content.match(/^(['"]use strict['"];?)/);
  if (strictMatch) {
    content = strictMatch[0] + SHELL_DETECTION_CODE + content.slice(strictMatch[0].length);
  } else {
    content = SHELL_DETECTION_CODE + content;
  }

  // Bypass POSIX shell requirement with runtime detection
  const shellCheckPattern = /if\(!J\)\{let F="No suitable shell found[^}]+throw[^}]+\}/;
  const shellCheckReplacement = 'if(!J){J=__atomcli_detectShell()}';

  if (shellCheckPattern.test(content)) {
    content = content.replace(shellCheckPattern, shellCheckReplacement);
  }

  return content;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build executable for a target
 *
 * Compiles a CLI tool into a standalone executable for the specified target.
 * Supports multiple CLI tools via toolId and toolConfig parameters.
 *
 * @param {string} targetId - Target ID (e.g., 'windows-x64', 'linux-arm64')
 * @param {string} sourceDir - Source directory (e.g., core/claude-code/package)
 * @param {string} outputDir - Output directory (e.g., distro)
 * @param {Object} [options]
 * @param {Function} [options.onStatus] - Status callback
 * @param {Function} [options.onProgress] - Progress callback
 * @param {string} [options.toolId] - Tool ID (e.g., 'claude-code', 'codex')
 * @param {Object} [options.toolConfig] - Tool configuration from CLI_REGISTRY
 * @returns {Promise<Object>} - Build result
 */
async function buildTarget(targetId, sourceDir, outputDir, options = {}) {
  const { onStatus, onProgress, toolId, toolConfig } = options;

  // Generate tool-specific targets or use defaults
  const targets = toolConfig
    ? generateBuildTargets(toolId || 'claude-code', toolConfig)
    : BUILD_TARGETS;

  const target = targets[targetId];
  if (!target) {
    throw new Error(`Unknown target: ${targetId}`);
  }

  if (!hasBun()) {
    throw new Error('Bun is required to build executables. Install from https://bun.sh');
  }

  const startTime = Date.now();
  const toolName = toolConfig?.name || 'CLI';

  // Prepare source (pass toolConfig for dynamic entry point and patches)
  onStatus?.(`Preparing ${toolName} source for ${target.platform}...`);
  const preparedSource = await prepareSource(sourceDir, target.platform, {
    onStatus,
    toolConfig,
  });

  // Ensure output directory exists
  const platformDir = path.join(outputDir, target.platform);
  if (!fs.existsSync(platformDir)) {
    fs.mkdirSync(platformDir, { recursive: true });
  }

  const outputPath = path.join(platformDir, target.output);

  // Build with Bun
  onStatus?.(`Building ${target.output}...`);

  const bunPath = findBunPath();
  if (!bunPath) {
    throw new Error('Bun not found. Install from https://bun.sh');
  }

  return new Promise((resolve, reject) => {
    const args = [
      'build',
      '--compile',
      '--minify',
      '--sourcemap',
      `--target=${target.target}`,
      preparedSource,
      `--outfile=${outputPath}`,
    ];

    const bunProcess = spawn(bunPath, args, {
      cwd: sourceDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      // Don't use shell - direct execution with full path works better
    });

    let stdout = '';
    let stderr = '';

    bunProcess.stdout.on('data', data => {
      stdout += data.toString();
      onProgress?.(data.toString());
    });

    bunProcess.stderr.on('data', data => {
      stderr += data.toString();
    });

    bunProcess.on('close', (code) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (code === 0) {
        // Get file size
        let fileSize = 0;
        try {
          fileSize = fs.statSync(outputPath).size;
        } catch {}

        resolve({
          success: true,
          target: targetId,
          toolId: toolId || 'claude-code',
          output: outputPath,
          elapsed: `${elapsed}s`,
          size: fileSize,
          sizeMB: (fileSize / (1024 * 1024)).toFixed(1),
        });
      } else {
        reject(new Error(`Build failed for ${targetId}:\n${stderr}`));
      }
    });

    bunProcess.on('error', reject);
  });
}

/**
 * Build multiple targets
 * @param {string[]} targetIds - Array of target IDs
 * @param {string} sourceDir
 * @param {string} outputDir
 * @param {Object} [options]
 * @returns {Promise<Object[]>}
 */
async function buildTargets(targetIds, sourceDir, outputDir, options = {}) {
  const results = [];

  for (const targetId of targetIds) {
    try {
      const result = await buildTarget(targetId, sourceDir, outputDir, options);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        target: targetId,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Build all targets for a platform
 * @param {string} platform - 'windows', 'linux', or 'macos'
 * @param {string} sourceDir
 * @param {string} outputDir
 * @param {Object} [options]
 * @returns {Promise<Object[]>}
 */
async function buildPlatform(platform, sourceDir, outputDir, options = {}) {
  const targets = Object.keys(getTargetsForPlatform(platform));
  return buildTargets(targets, sourceDir, outputDir, options);
}

/**
 * Clean build artifacts
 * @param {string} sourceDir
 */
function cleanBuildArtifacts(sourceDir) {
  const artifacts = [
    'cli-prepared.js',
    'cli-windows-prepared.js',
    'cli-native-bundled.js',
    '.windows-build-temp',
  ];

  for (const artifact of artifacts) {
    const artifactPath = path.join(sourceDir, artifact);
    if (fs.existsSync(artifactPath)) {
      if (fs.statSync(artifactPath).isDirectory()) {
        fs.rmSync(artifactPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(artifactPath);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL BUILD PREPARATION
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose: Prepare local tools (like launcher) for building
//
// Unlike npm tools that are downloaded, local tools exist in the components/
// directory and need to be copied to core/{tool}/package/ for the build.
//
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Prepare a local tool for building
 *
 * Local tools are not downloaded from npm but exist in the components/ directory.
 * This function copies the necessary files to the expected build location.
 *
 * @param {string} toolId - Tool ID from CLI_REGISTRY (e.g., 'launcher')
 * @param {string} rootDir - Project root directory
 * @param {Object} [options]
 * @param {Function} [options.onStatus] - Status callback
 * @returns {Promise<Object>} - { sourceDir, files }
 */
async function prepareLocalBuild(toolId, rootDir, options = {}) {
  const { onStatus } = options;

  // Load CLI_REGISTRY from downloader
  const { CLI_REGISTRY } = require('../downloader');
  const toolConfig = CLI_REGISTRY[toolId];

  if (!toolConfig) {
    throw new Error(`Unknown tool: ${toolId}`);
  }

  if (!toolConfig.local) {
    throw new Error(`Tool "${toolId}" is not a local build`);
  }

  onStatus?.(`Preparing local build for ${toolConfig.name}...`);

  // Determine source and destination paths
  const destDir = path.join(rootDir, 'core', toolId, 'package');

  // Create destination directory
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // For launcher, copy files from components/launcher/
  if (toolId === 'launcher') {
    const launcherDir = path.join(rootDir, 'components', 'launcher');
    const secretsDir = path.join(rootDir, 'components', 'secrets');

    // Copy launcher files
    const launcherFiles = ['launcher-cli.js', 'index.js'];
    for (const file of launcherFiles) {
      const src = path.join(launcherDir, file);
      const dst = path.join(destDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
        onStatus?.(`  Copied ${file}`);
      }
    }

    // Copy secrets module (launcher imports ../secrets)
    const secretsDestDir = path.join(destDir, '..', 'secrets');
    if (!fs.existsSync(secretsDestDir)) {
      fs.mkdirSync(secretsDestDir, { recursive: true });
    }

    const secretsFiles = ['index.js'];
    for (const file of secretsFiles) {
      const src = path.join(secretsDir, file);
      const dst = path.join(secretsDestDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
        onStatus?.(`  Copied secrets/${file}`);
      }
    }

    // Create a simple package.json for the build
    const packageJson = {
      name: 'atomcli-launcher',
      version: '1.0.0',
      main: 'launcher-cli.js',
    };
    fs.writeFileSync(
      path.join(destDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    onStatus?.('  Created package.json');
  }

  const files = fs.readdirSync(destDir);
  onStatus?.(`Local build prepared: ${files.length} files`);

  return {
    sourceDir: destDir,
    files,
    toolConfig,
  };
}

/**
 * Check if a tool is a local build
 * @param {string} toolId - Tool ID
 * @returns {boolean}
 */
function isLocalBuild(toolId) {
  const { CLI_REGISTRY } = require('../downloader');
  return CLI_REGISTRY[toolId]?.local === true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Build functions
  buildTarget,
  buildTargets,
  buildPlatform,
  prepareSource,
  cleanBuildArtifacts,

  // Local build support
  prepareLocalBuild,
  isLocalBuild,

  // Utilities
  hasBun,
  getBunVersion,
  findBunPath,
  getCurrentTarget,
  getTargetsForPlatform,

  // Multi-CLI support
  generateBuildTargets,
  BUILD_TARGET_TEMPLATES,

  // Configuration (default Claude Code targets for backwards compatibility)
  BUILD_TARGETS,
};
