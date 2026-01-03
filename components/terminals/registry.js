/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                       ATOMCLI - TERMINAL REGISTRY                            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Registry of downloadable terminal emulators and TUI tools                   ║
 * ║                                                                              ║
 * ║  Supported Terminals:                                                        ║
 * ║  - eDEX-UI - Sci-fi inspired terminal emulator                               ║
 * ║  - Ghostty - Fast GPU-accelerated terminal                                   ║
 * ║  - Lazygit - Simple terminal UI for git commands                             ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// ═══════════════════════════════════════════════════════════════════════════════
// TERMINAL REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose: Define terminal emulators and TUI tools that can be bundled
//
// Terminal Types:
//   - terminal_emulator: Full terminal emulator (eDEX-UI, Ghostty)
//   - tui_tool: Terminal-based UI tool (Lazygit)
//
// Each entry contains:
//   - name: Display name
//   - description: Short description
//   - type: 'terminal_emulator' or 'tui_tool'
//   - github: GitHub repository (owner/repo)
//   - executable: Executable name per platform
//   - releasePattern: Regex to match release assets
//   - portable: Whether it can run without installation
//   - features: Notable features
//   - category: Optional category for TUI tools
//
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Registry of supported terminals and TUI tools
 */
const TERMINAL_REGISTRY = {
  // ─────────────────────────────────────────────────────────────────────────────
  // EDEX-UI
  // Sci-fi inspired fullscreen terminal emulator
  // https://github.com/GitSquared/edex-ui
  // ─────────────────────────────────────────────────────────────────────────────
  'edex-ui': {
    name: 'eDEX-UI',
    description: 'Sci-fi inspired terminal emulator',
    type: 'terminal_emulator',
    github: 'GitSquared/edex-ui',
    executable: {
      windows: 'eDEX-UI.exe',
      linux: 'eDEX-UI.AppImage',
      darwin: 'eDEX-UI.app',
    },
    releasePattern: {
      windows: /eDEX-UI\.Windows\.Installer\.exe|eDEX-UI-win32-x64\.zip/,
      linux: /eDEX-UI\.Linux\.x86_64\.AppImage/,
      darwin: /eDEX-UI\.macOS\.dmg|eDEX-UI-darwin-x64\.zip/,
    },
    portable: {
      windows: true,   // Can use zip version
      linux: true,     // AppImage is portable
      darwin: false,   // DMG needs installation
    },
    features: [
      'fullscreen',
      'matrix-rain',
      'system-monitor',
      'file-browser',
      'keyboard-sounds',
      'customizable-themes',
    ],
    requirements: {
      disk: '200MB',
      memory: '512MB',
    },
    installable: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GHOSTTY
  // Fast GPU-accelerated terminal emulator
  // https://github.com/ghostty-org/ghostty
  // ─────────────────────────────────────────────────────────────────────────────
  'ghostty': {
    name: 'Ghostty',
    description: 'Fast GPU-accelerated terminal',
    type: 'terminal_emulator',
    github: 'ghostty-org/ghostty',
    executable: {
      windows: 'ghostty.exe',
      linux: 'ghostty',
      darwin: 'Ghostty.app',
    },
    releasePattern: {
      windows: /ghostty-windows-x86_64\.zip/,
      linux: /ghostty-linux-x86_64\.tar\.gz|ghostty\.AppImage/,
      darwin: /Ghostty\.dmg|ghostty-macos\.zip/,
    },
    portable: {
      windows: true,
      linux: true,
      darwin: false,
    },
    features: [
      'gpu-accelerated',
      'fast-rendering',
      'minimal-latency',
      'kitty-compatible',
      'native-tabs',
      'splits',
    ],
    requirements: {
      disk: '50MB',
      memory: '256MB',
      gpu: 'OpenGL 3.3+',
    },
    installable: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // LAZYGIT
  // Simple terminal UI for git commands
  // https://github.com/jesseduffield/lazygit
  // ─────────────────────────────────────────────────────────────────────────────
  'lazygit': {
    name: 'Lazygit',
    description: 'Simple terminal UI for git commands',
    type: 'tui_tool',
    category: 'git',
    github: 'jesseduffield/lazygit',
    executable: {
      windows: 'lazygit.exe',
      linux: 'lazygit',
      darwin: 'lazygit',
    },
    releasePattern: {
      windows: /lazygit_\d+\.\d+\.\d+_Windows_x86_64\.zip/,
      linux: /lazygit_\d+\.\d+\.\d+_Linux_x86_64\.tar\.gz/,
      darwin: /lazygit_\d+\.\d+\.\d+_Darwin_x86_64\.tar\.gz/,
    },
    portable: {
      windows: true,
      linux: true,
      darwin: true,
    },
    features: [
      'visual-staging',
      'easy-rebasing',
      'commit-graph',
      'merge-conflict-resolution',
      'stash-management',
      'keyboard-driven',
    ],
    requirements: {
      disk: '10MB',
      memory: '64MB',
    },
    installable: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Additional TUI tools can be added here
  // ─────────────────────────────────────────────────────────────────────────────

  // Example structure for future additions:
  // 'lazydocker': {
  //   name: 'Lazydocker',
  //   description: 'Terminal UI for Docker',
  //   type: 'tui_tool',
  //   category: 'docker',
  //   github: 'jesseduffield/lazydocker',
  //   ...
  // },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TERMINAL DETECTION
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
 * Check if a terminal/TUI tool is available
 * @param {string} terminalId - Terminal ID from registry
 * @param {string} [coreDir] - Directory to check for downloaded terminals
 * @returns {Object} { available: boolean, path: string|null, version: string|null }
 */
function checkTerminalAvailable(terminalId, coreDir = null) {
  const terminal = TERMINAL_REGISTRY[terminalId];
  if (!terminal) {
    return { available: false, path: null, version: null, reason: 'Unknown terminal' };
  }

  const platform = getPlatformKey();
  const executable = terminal.executable?.[platform];

  if (!executable) {
    return { available: false, path: null, version: null, reason: 'No executable for platform' };
  }

  // Check core/terminals directory first
  if (coreDir) {
    const terminalPath = path.join(coreDir, 'terminals', terminalId, executable);
    if (fs.existsSync(terminalPath)) {
      const version = getTerminalVersion(terminalPath, terminalId);
      return { available: true, path: terminalPath, version, source: 'bundled' };
    }
  }

  // Check PATH
  try {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const result = execSync(`${which} ${executable}`, { stdio: 'pipe' }).toString().trim();
    if (result) {
      const foundPath = result.split('\n')[0].trim();
      const version = getTerminalVersion(foundPath, terminalId);
      return { available: true, path: foundPath, version, source: 'system' };
    }
  } catch (e) {}

  return { available: false, path: null, version: null, reason: 'Not installed' };
}

/**
 * Get terminal version
 * @param {string} terminalPath - Path to executable
 * @param {string} terminalId - Terminal ID
 * @returns {string|null} Version string or null
 */
function getTerminalVersion(terminalPath, terminalId) {
  try {
    const result = execSync(`"${terminalPath}" --version`, { stdio: 'pipe' }).toString().trim();
    const match = result.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}

/**
 * Get all available terminals
 * @param {string} [coreDir] - Core directory
 * @returns {Object[]} Array of terminal info with availability
 */
function getAvailableTerminals(coreDir = null) {
  const results = [];

  for (const [id, terminal] of Object.entries(TERMINAL_REGISTRY)) {
    const availability = checkTerminalAvailable(id, coreDir);
    results.push({
      id,
      name: terminal.name,
      description: terminal.description,
      type: terminal.type,
      category: terminal.category,
      features: terminal.features || [],
      ...availability,
    });
  }

  return results;
}

/**
 * Get terminals by type
 * @param {string} type - 'terminal_emulator' or 'tui_tool'
 * @param {string} [coreDir] - Core directory
 * @returns {Object[]} Array of matching terminals
 */
function getTerminalsByType(type, coreDir = null) {
  return getAvailableTerminals(coreDir).filter(t => {
    const terminal = TERMINAL_REGISTRY[t.id];
    return terminal.type === type;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TERMINAL DOWNLOAD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get download info for a terminal
 * @param {string} terminalId - Terminal ID
 * @returns {Object|null} Download info or null if not downloadable
 */
function getTerminalDownloadInfo(terminalId) {
  const terminal = TERMINAL_REGISTRY[terminalId];
  if (!terminal || !terminal.installable || !terminal.github) {
    return null;
  }

  const platform = getPlatformKey();
  const pattern = terminal.releasePattern?.[platform];

  if (!pattern) {
    return null;
  }

  return {
    id: terminalId,
    name: terminal.name,
    type: terminal.type,
    github: terminal.github,
    releasePattern: pattern,
    platform,
    portable: terminal.portable?.[platform] || false,
    requirements: terminal.requirements,
  };
}

/**
 * Get list of downloadable terminals for current platform
 * @returns {Object[]} Array of downloadable terminal info
 */
function getDownloadableTerminals() {
  const platform = getPlatformKey();
  const results = [];

  for (const [id, terminal] of Object.entries(TERMINAL_REGISTRY)) {
    if (!terminal.installable) continue;
    if (!terminal.releasePattern?.[platform]) continue;

    results.push({
      id,
      name: terminal.name,
      description: terminal.description,
      type: terminal.type,
      category: terminal.category,
      github: terminal.github,
      portable: terminal.portable?.[platform] || false,
    });
  }

  return results;
}

/**
 * Get terminal run command
 * @param {string} terminalId - Terminal ID
 * @param {Object} [options] - Options
 * @param {string} [options.coreDir] - Core directory
 * @param {string} [options.command] - Command to run in terminal
 * @returns {Object|null} { executable, args } or null
 */
function getTerminalRunCommand(terminalId, options = {}) {
  const { coreDir, command } = options;

  const availability = checkTerminalAvailable(terminalId, coreDir);
  if (!availability.available) return null;

  const terminal = TERMINAL_REGISTRY[terminalId];

  // Build command based on terminal type
  let args = [];

  if (terminal.type === 'terminal_emulator') {
    // Terminal emulators usually take -e or --command
    if (command) {
      args = ['-e', command];
    }
  } else if (terminal.type === 'tui_tool') {
    // TUI tools just run directly
    // No special args needed
  }

  return {
    executable: availability.path,
    args,
    type: terminal.type,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Registry
  TERMINAL_REGISTRY,

  // Detection
  getPlatformKey,
  checkTerminalAvailable,
  getTerminalVersion,
  getAvailableTerminals,
  getTerminalsByType,

  // Download
  getTerminalDownloadInfo,
  getDownloadableTerminals,

  // Run
  getTerminalRunCommand,
};
