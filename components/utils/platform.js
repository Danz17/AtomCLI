/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                         ATOMCLI - PLATFORM MODULE                            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Platform detection and dependency checking                                  ║
 * ║                                                                              ║
 * ║  Detects:                                                                    ║
 * ║  - Operating System (Windows, Linux, macOS)                                  ║
 * ║  - Architecture (x64, arm64, x86)                                            ║
 * ║  - Available runtimes (Node.js, Bun, Deno)                                   ║
 * ║  - Shell environment (cmd, PowerShell, bash, zsh)                            ║
 * ║  - Build tools (Git, npm, yarn, pnpm)                                        ║
 * ║                                                                              ║
 * ║  Usage:                                                                      ║
 * ║    const platform = require('./platform');                                   ║
 * ║    const info = platform.detect();                                           ║
 * ║    const deps = await platform.checkDependencies();                          ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────────────────────────────────────
// Platform Constants
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORMS = {
  WINDOWS: 'windows',
  LINUX: 'linux',
  MACOS: 'macos',
  UNKNOWN: 'unknown',
};

const ARCHITECTURES = {
  X64: 'x64',
  ARM64: 'arm64',
  X86: 'x86',
  ARM: 'arm',
  UNKNOWN: 'unknown',
};

const RUNTIMES = {
  NODE: 'node',
  BUN: 'bun',
  DENO: 'deno',
};

const SHELLS = {
  CMD: 'cmd',
  POWERSHELL: 'powershell',
  PWSH: 'pwsh',
  BASH: 'bash',
  ZSH: 'zsh',
  SH: 'sh',
  FISH: 'fish',
};

// ─────────────────────────────────────────────────────────────────────────────
// Detection Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely execute a command and return output
 * @param {string} command
 * @returns {string|null}
 */
function safeExec(command) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Check if a command exists
 * @param {string} command
 * @returns {boolean}
 */
function commandExists(command) {
  const checkCmd = process.platform === 'win32'
    ? `where ${command}`
    : `which ${command}`;
  return safeExec(checkCmd) !== null;
}

/**
 * Get command version
 * @param {string} command
 * @param {string} [versionFlag='--version']
 * @returns {string|null}
 */
function getVersion(command, versionFlag = '--version') {
  const output = safeExec(`${command} ${versionFlag}`);
  if (!output) return null;

  // Extract version number (handles various formats)
  const match = output.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : output.split('\n')[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect current operating system
 * @returns {string}
 */
function detectOS() {
  switch (process.platform) {
    case 'win32':
      return PLATFORMS.WINDOWS;
    case 'linux':
      return PLATFORMS.LINUX;
    case 'darwin':
      return PLATFORMS.MACOS;
    default:
      return PLATFORMS.UNKNOWN;
  }
}

/**
 * Detect system architecture
 * @returns {string}
 */
function detectArch() {
  switch (process.arch) {
    case 'x64':
    case 'amd64':
      return ARCHITECTURES.X64;
    case 'arm64':
    case 'aarch64':
      return ARCHITECTURES.ARM64;
    case 'ia32':
    case 'x86':
      return ARCHITECTURES.X86;
    case 'arm':
      return ARCHITECTURES.ARM;
    default:
      return ARCHITECTURES.UNKNOWN;
  }
}

/**
 * Detect Windows version details
 * @returns {Object|null}
 */
function detectWindowsVersion() {
  if (process.platform !== 'win32') return null;

  const release = os.release();
  const [major, minor, build] = release.split('.').map(Number);

  let name = 'Windows';
  if (major === 10 && build >= 22000) {
    name = 'Windows 11';
  } else if (major === 10) {
    name = 'Windows 10';
  } else if (major === 6 && minor === 3) {
    name = 'Windows 8.1';
  } else if (major === 6 && minor === 2) {
    name = 'Windows 8';
  } else if (major === 6 && minor === 1) {
    name = 'Windows 7';
  }

  return {
    name,
    version: release,
    build,
    isModern: major >= 10 && build >= 14393, // ANSI support
  };
}

/**
 * Detect Linux distribution
 * @returns {Object|null}
 */
function detectLinuxDistro() {
  if (process.platform !== 'linux') return null;

  // Try /etc/os-release first
  try {
    const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
    const lines = osRelease.split('\n');
    const info = {};

    lines.forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        info[key] = value.replace(/"/g, '');
      }
    });

    return {
      name: info.NAME || info.ID || 'Linux',
      version: info.VERSION_ID || info.VERSION || '',
      id: info.ID || 'linux',
      pretty: info.PRETTY_NAME || info.NAME || 'Linux',
      isMusl: safeExec('ldd --version 2>&1')?.includes('musl') ?? false,
    };
  } catch {
    return {
      name: 'Linux',
      version: os.release(),
      id: 'linux',
      pretty: 'Linux',
      isMusl: false,
    };
  }
}

/**
 * Detect macOS version
 * @returns {Object|null}
 */
function detectMacOSVersion() {
  if (process.platform !== 'darwin') return null;

  const version = safeExec('sw_vers -productVersion') || os.release();
  const [major, minor] = version.split('.').map(Number);

  const names = {
    15: 'Sequoia',
    14: 'Sonoma',
    13: 'Ventura',
    12: 'Monterey',
    11: 'Big Sur',
    10: 'Catalina', // Actually 10.15
  };

  return {
    name: `macOS ${names[major] || ''}`.trim(),
    version,
    isAppleSilicon: process.arch === 'arm64',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect available JavaScript runtimes
 * @returns {Object[]}
 */
function detectRuntimes() {
  const runtimes = [];

  // Node.js
  if (commandExists('node')) {
    runtimes.push({
      name: RUNTIMES.NODE,
      version: getVersion('node', '-v')?.replace('v', ''),
      path: safeExec(process.platform === 'win32' ? 'where node' : 'which node'),
      available: true,
    });
  }

  // Bun
  if (commandExists('bun')) {
    runtimes.push({
      name: RUNTIMES.BUN,
      version: getVersion('bun'),
      path: safeExec(process.platform === 'win32' ? 'where bun' : 'which bun'),
      available: true,
    });
  }

  // Deno
  if (commandExists('deno')) {
    runtimes.push({
      name: RUNTIMES.DENO,
      version: getVersion('deno'),
      path: safeExec(process.platform === 'win32' ? 'where deno' : 'which deno'),
      available: true,
    });
  }

  return runtimes;
}

/**
 * Detect current shell
 * @returns {Object}
 */
function detectShell() {
  const platform = process.platform;

  if (platform === 'win32') {
    // Check if running in PowerShell
    if (process.env.PSModulePath) {
      const isPwsh = process.env.PSVersionTable?.PSEdition === 'Core';
      return {
        name: isPwsh ? SHELLS.PWSH : SHELLS.POWERSHELL,
        version: safeExec('$PSVersionTable.PSVersion.ToString()'),
        path: isPwsh
          ? safeExec('where pwsh')
          : safeExec('where powershell'),
      };
    }

    // Default to cmd
    return {
      name: SHELLS.CMD,
      version: null,
      path: process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
    };
  }

  // Unix-like systems
  const shellPath = process.env.SHELL || '/bin/sh';
  const shellName = path.basename(shellPath);

  return {
    name: shellName,
    version: getVersion(shellPath),
    path: shellPath,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dependency Checking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check all dependencies
 * @returns {Object}
 */
function checkDependencies() {
  const deps = {
    required: [],
    optional: [],
    missing: [],
  };

  // Required dependencies
  const requiredDeps = [
    { name: 'git', check: () => commandExists('git'), version: () => getVersion('git') },
  ];

  // Optional dependencies
  const optionalDeps = [
    { name: 'node', check: () => commandExists('node'), version: () => getVersion('node', '-v')?.replace('v', '') },
    { name: 'bun', check: () => commandExists('bun'), version: () => getVersion('bun') },
    { name: 'npm', check: () => commandExists('npm'), version: () => getVersion('npm', '-v') },
    { name: 'yarn', check: () => commandExists('yarn'), version: () => getVersion('yarn', '-v') },
    { name: 'pnpm', check: () => commandExists('pnpm'), version: () => getVersion('pnpm', '-v') },
    { name: 'curl', check: () => commandExists('curl'), version: () => getVersion('curl') },
    { name: 'tar', check: () => commandExists('tar'), version: () => getVersion('tar') },
  ];

  // Check required
  requiredDeps.forEach(dep => {
    const exists = dep.check();
    const info = {
      name: dep.name,
      available: exists,
      version: exists ? dep.version() : null,
    };
    if (exists) {
      deps.required.push(info);
    } else {
      deps.missing.push(info);
    }
  });

  // Check optional
  optionalDeps.forEach(dep => {
    const exists = dep.check();
    deps.optional.push({
      name: dep.name,
      available: exists,
      version: exists ? dep.version() : null,
    });
  });

  return deps;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Detection Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect all platform information
 * @returns {Object}
 */
function detect() {
  const platform = detectOS();

  const info = {
    os: platform,
    arch: detectArch(),
    runtimes: detectRuntimes(),
    shell: detectShell(),
    homeDir: os.homedir(),
    tempDir: os.tmpdir(),
    cpus: os.cpus().length,
    memory: Math.round(os.totalmem() / (1024 * 1024 * 1024)), // GB
    hostname: os.hostname(),
    username: os.userInfo().username,
  };

  // Platform-specific details
  switch (platform) {
    case PLATFORMS.WINDOWS:
      info.osDetails = detectWindowsVersion();
      break;
    case PLATFORMS.LINUX:
      info.osDetails = detectLinuxDistro();
      break;
    case PLATFORMS.MACOS:
      info.osDetails = detectMacOSVersion();
      break;
  }

  return info;
}

/**
 * Get build target string for current platform
 * @returns {string}
 */
function getBuildTarget() {
  const platform = detectOS();
  const arch = detectArch();

  const platformMap = {
    [PLATFORMS.WINDOWS]: 'windows',
    [PLATFORMS.LINUX]: 'linux',
    [PLATFORMS.MACOS]: 'darwin',
  };

  return `bun-${platformMap[platform] || 'linux'}-${arch}`;
}

/**
 * Check if running as administrator/root
 * @returns {boolean}
 */
function isElevated() {
  if (process.platform === 'win32') {
    try {
      execSync('net session', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
  return process.getuid?.() === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Detection
  detect,
  detectOS,
  detectArch,
  detectRuntimes,
  detectShell,
  checkDependencies,
  getBuildTarget,
  isElevated,

  // Helpers
  commandExists,
  getVersion,
  safeExec,

  // Constants
  PLATFORMS,
  ARCHITECTURES,
  RUNTIMES,
  SHELLS,
};
