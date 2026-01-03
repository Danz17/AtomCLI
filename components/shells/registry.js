/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                        ATOMCLI - SHELL REGISTRY                              ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Registry of downloadable/bundleable shells                                  ║
 * ║                                                                              ║
 * ║  Supported Shells:                                                           ║
 * ║  - PowerShell Core (pwsh) - Cross-platform modern PowerShell                 ║
 * ║  - GNU Bash - Standard Unix shell                                            ║
 * ║  - Z Shell (zsh) - Extended Bourne shell                                     ║
 * ║  - Fish Shell - User-friendly interactive shell                              ║
 * ║  - Clink - Windows cmd.exe enhancement                                       ║
 * ║  - Nushell - Modern shell with structured data                               ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// ═══════════════════════════════════════════════════════════════════════════════
// SHELL REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose: Define shells that can be downloaded and bundled with AtomCLI
//
// Each shell entry contains:
//   - name: Display name
//   - description: Short description
//   - github: GitHub repository (owner/repo)
//   - executable: Executable name per platform
//   - systemPath: Common system paths where shell might be installed
//   - releasePattern: Regex to match release assets
//   - platforms: Supported platforms (default: all)
//   - installable: Whether we can download/install it
//   - features: Notable features
//
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Registry of supported shells
 */
const SHELL_REGISTRY = {
  // ─────────────────────────────────────────────────────────────────────────────
  // POWERSHELL CORE
  // Cross-platform modern PowerShell (successor to Windows PowerShell)
  // ─────────────────────────────────────────────────────────────────────────────
  'pwsh': {
    name: 'PowerShell Core',
    description: 'Cross-platform modern PowerShell',
    github: 'PowerShell/PowerShell',
    executable: {
      windows: 'pwsh.exe',
      linux: 'pwsh',
      darwin: 'pwsh',
    },
    systemPath: {
      windows: [
        'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
        'C:\\Program Files\\PowerShell\\pwsh.exe',
      ],
      linux: ['/usr/bin/pwsh', '/opt/microsoft/powershell/7/pwsh'],
      darwin: ['/usr/local/bin/pwsh', '/opt/homebrew/bin/pwsh'],
    },
    releasePattern: {
      windows: /PowerShell-\d+\.\d+\.\d+-win-x64\.zip/,
      linux: /powershell-\d+\.\d+\.\d+-linux-x64\.tar\.gz/,
      darwin: /powershell-\d+\.\d+\.\d+-osx-x64\.tar\.gz/,
    },
    installable: true,
    features: ['cross-platform', 'object-pipeline', 'scripting'],
    args: ['-NoLogo', '-NoProfile'],
    runArgs: ['-Command'],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GNU BASH
  // Standard Unix shell (usually pre-installed)
  // ─────────────────────────────────────────────────────────────────────────────
  'bash': {
    name: 'GNU Bash',
    description: 'Standard Unix shell',
    github: null,  // Use system bash, not downloadable
    executable: {
      windows: 'bash.exe',
      linux: 'bash',
      darwin: 'bash',
    },
    systemPath: {
      windows: [
        'C:\\Program Files\\Git\\bin\\bash.exe',
        'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
        'C:\\Windows\\System32\\bash.exe',  // WSL
      ],
      linux: ['/bin/bash', '/usr/bin/bash'],
      darwin: ['/bin/bash', '/usr/local/bin/bash'],
    },
    installable: false,  // Use system-provided bash
    features: ['ubiquitous', 'scripting', 'unix-standard'],
    runArgs: ['-c'],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Z SHELL
  // Extended Bourne shell with many improvements
  // ─────────────────────────────────────────────────────────────────────────────
  'zsh': {
    name: 'Z Shell',
    description: 'Extended Bourne shell with enhancements',
    github: null,  // Use system zsh
    executable: {
      linux: 'zsh',
      darwin: 'zsh',
    },
    systemPath: {
      linux: ['/bin/zsh', '/usr/bin/zsh'],
      darwin: ['/bin/zsh', '/usr/local/bin/zsh'],
    },
    platforms: ['linux', 'darwin'],
    installable: false,  // Use system-provided zsh
    features: ['completion', 'themes', 'plugins', 'oh-my-zsh'],
    runArgs: ['-c'],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // FISH SHELL
  // User-friendly interactive shell
  // ─────────────────────────────────────────────────────────────────────────────
  'fish': {
    name: 'Fish Shell',
    description: 'User-friendly interactive shell',
    github: 'fish-shell/fish-shell',
    executable: {
      linux: 'fish',
      darwin: 'fish',
    },
    systemPath: {
      linux: ['/usr/bin/fish', '/usr/local/bin/fish'],
      darwin: ['/usr/local/bin/fish', '/opt/homebrew/bin/fish'],
    },
    releasePattern: {
      linux: /fish-\d+\.\d+\.\d+-linux-x86_64\.tar\.xz/,
      darwin: /fish-\d+\.\d+\.\d+\.pkg/,
    },
    platforms: ['linux', 'darwin'],
    installable: true,
    features: ['autosuggestions', 'syntax-highlighting', 'web-config'],
    runArgs: ['-c'],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CLINK
  // Enhanced cmd.exe with readline-style editing (Windows only)
  // ─────────────────────────────────────────────────────────────────────────────
  'clink': {
    name: 'Clink',
    description: 'Enhanced Windows command prompt',
    github: 'chrisant996/clink',
    executable: {
      windows: 'clink_x64.exe',
    },
    releasePattern: {
      windows: /clink\.\d+\.\d+\.\d+\.\w+\.zip/,
    },
    platforms: ['windows'],
    installable: true,
    features: ['readline', 'completion', 'history', 'scripting'],
    injectCmd: true,  // Clink injects into cmd.exe
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // NUSHELL
  // Modern shell with structured data pipelines
  // ─────────────────────────────────────────────────────────────────────────────
  'nushell': {
    name: 'Nushell',
    description: 'Modern shell with structured data',
    github: 'nushell/nushell',
    executable: {
      windows: 'nu.exe',
      linux: 'nu',
      darwin: 'nu',
    },
    systemPath: {
      windows: [],
      linux: ['/usr/bin/nu', '/usr/local/bin/nu'],
      darwin: ['/usr/local/bin/nu', '/opt/homebrew/bin/nu'],
    },
    releasePattern: {
      windows: /nu-\d+\.\d+\.\d+-x86_64-pc-windows-msvc\.zip/,
      linux: /nu-\d+\.\d+\.\d+-x86_64-unknown-linux-gnu\.tar\.gz/,
      darwin: /nu-\d+\.\d+\.\d+-x86_64-apple-darwin\.tar\.gz/,
    },
    installable: true,
    features: ['structured-data', 'modern', 'cross-platform', 'typed'],
    runArgs: ['-c'],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SHELL DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current platform key
 * @returns {string} 'windows', 'linux', or 'darwin'
 */
function getPlatformKey() {
  switch (process.platform) {
    case 'win32': return 'windows';
    case 'darwin': return 'darwin';
    default: return 'linux';
  }
}

/**
 * Check if a shell is available on the system
 * @param {string} shellId - Shell ID from registry
 * @returns {Object} { available: boolean, path: string|null, version: string|null }
 */
function checkShellAvailable(shellId) {
  const shell = SHELL_REGISTRY[shellId];
  if (!shell) {
    return { available: false, path: null, version: null, reason: 'Unknown shell' };
  }

  const platform = getPlatformKey();

  // Check if supported on this platform
  if (shell.platforms && !shell.platforms.includes(platform)) {
    return { available: false, path: null, version: null, reason: `Not supported on ${platform}` };
  }

  const executable = shell.executable?.[platform];
  if (!executable) {
    return { available: false, path: null, version: null, reason: 'No executable for platform' };
  }

  // Check system paths first
  const systemPaths = shell.systemPath?.[platform] || [];
  for (const sysPath of systemPaths) {
    if (fs.existsSync(sysPath)) {
      const version = getShellVersion(sysPath, shellId);
      return { available: true, path: sysPath, version, source: 'system' };
    }
  }

  // Check PATH
  try {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const result = execSync(`${which} ${executable}`, { stdio: 'pipe' }).toString().trim();
    if (result) {
      const foundPath = result.split('\n')[0].trim();
      const version = getShellVersion(foundPath, shellId);
      return { available: true, path: foundPath, version, source: 'path' };
    }
  } catch (e) {}

  return { available: false, path: null, version: null, reason: 'Not installed' };
}

/**
 * Get shell version
 * @param {string} shellPath - Path to shell executable
 * @param {string} shellId - Shell ID
 * @returns {string|null} Version string or null
 */
function getShellVersion(shellPath, shellId) {
  try {
    let versionArg = '--version';

    // PowerShell uses different version flag
    if (shellId === 'pwsh' || shellId === 'powershell') {
      const result = execSync(`"${shellPath}" -Version`, { stdio: 'pipe' }).toString().trim();
      return result;
    }

    const result = execSync(`"${shellPath}" ${versionArg}`, { stdio: 'pipe' }).toString().trim();

    // Extract version number from output
    const match = result.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : result.split('\n')[0];
  } catch (e) {
    return null;
  }
}

/**
 * Get all available shells on the system
 * @returns {Object[]} Array of shell info with availability
 */
function getAvailableShells() {
  const platform = getPlatformKey();
  const results = [];

  for (const [id, shell] of Object.entries(SHELL_REGISTRY)) {
    // Skip shells not for this platform
    if (shell.platforms && !shell.platforms.includes(platform)) {
      continue;
    }

    const availability = checkShellAvailable(id);
    results.push({
      id,
      name: shell.name,
      description: shell.description,
      installable: shell.installable,
      features: shell.features || [],
      ...availability,
    });
  }

  return results;
}

/**
 * Get shell configuration for running commands
 * @param {string} shellId - Shell ID
 * @returns {Object|null} { executable, args } or null
 */
function getShellRunConfig(shellId) {
  const shell = SHELL_REGISTRY[shellId];
  if (!shell) return null;

  const availability = checkShellAvailable(shellId);
  if (!availability.available) return null;

  return {
    executable: availability.path,
    args: shell.args || [],
    runArgs: shell.runArgs || ['-c'],
    injectCmd: shell.injectCmd || false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHELL DOWNLOAD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get download info for a shell
 * @param {string} shellId - Shell ID
 * @returns {Object|null} Download info or null if not downloadable
 */
function getShellDownloadInfo(shellId) {
  const shell = SHELL_REGISTRY[shellId];
  if (!shell || !shell.installable || !shell.github) {
    return null;
  }

  const platform = getPlatformKey();
  const pattern = shell.releasePattern?.[platform];

  if (!pattern) {
    return null;
  }

  return {
    id: shellId,
    name: shell.name,
    github: shell.github,
    releasePattern: pattern,
    platform,
  };
}

/**
 * Get list of downloadable shells for current platform
 * @returns {Object[]} Array of downloadable shell info
 */
function getDownloadableShells() {
  const platform = getPlatformKey();
  const results = [];

  for (const [id, shell] of Object.entries(SHELL_REGISTRY)) {
    if (!shell.installable) continue;
    if (shell.platforms && !shell.platforms.includes(platform)) continue;
    if (!shell.releasePattern?.[platform]) continue;

    results.push({
      id,
      name: shell.name,
      description: shell.description,
      github: shell.github,
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Registry
  SHELL_REGISTRY,

  // Detection
  getPlatformKey,
  checkShellAvailable,
  getShellVersion,
  getAvailableShells,
  getShellRunConfig,

  // Download
  getShellDownloadInfo,
  getDownloadableShells,
};
