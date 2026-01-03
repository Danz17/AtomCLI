/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                        ATOMCLI - LAUNCHER MODULE                             ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Multi-app launcher for AI coding assistants                                 ║
 * ║                                                                              ║
 * ║  Features:                                                                   ║
 * ║  - Interactive menu to select Claude/Codex/Copilot/Gemini                    ║
 * ║  - Shell integration (spawn with preferred shell)                            ║
 * ║  - Configuration persistence                                                 ║
 * ║  - Last-used memory                                                          ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ═══════════════════════════════════════════════════════════════════════════════
// LAUNCHER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Default configuration for the launcher
 */
const DEFAULT_CONFIG = {
  startupMode: 'menu',      // 'menu', 'last-used', 'default'
  defaultApp: 'claude',     // Default app when startupMode is 'default'
  lastUsed: null,           // Last used app (auto-updated)
  shell: {
    preferred: 'auto',      // 'auto', 'pwsh', 'bash', 'cmd', etc.
    fallbacks: ['pwsh', 'bash', 'cmd'],
  },
  terminal: {
    preferred: 'default',   // 'default', 'edex-ui', 'ghostty'
  },
};

/**
 * Registry of supported AI CLI apps
 * Maps to CLI_REGISTRY in downloader module
 */
const APP_REGISTRY = {
  'claude': {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'AI coding assistant by Anthropic',
    icon: '[C]',
    hotkey: '1',
    envKey: 'ANTHROPIC_API_KEY',
    executable: 'claude-code',
  },
  'codex': {
    id: 'codex',
    name: 'OpenAI Codex',
    description: 'AI coding assistant by OpenAI',
    icon: '[O]',
    hotkey: '2',
    envKey: 'OPENAI_API_KEY',
    executable: 'codex',
  },
  'copilot': {
    id: 'copilot',
    name: 'GitHub Copilot',
    description: 'AI coding assistant by GitHub',
    icon: '[G]',
    hotkey: '3',
    envKey: 'GITHUB_TOKEN',
    executable: 'copilot',
  },
  'gemini': {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'AI coding assistant by Google',
    icon: '[*]',
    hotkey: '4',
    envKey: 'GOOGLE_API_KEY',
    executable: 'gemini',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the config directory path
 * @returns {string} Path to ~/.atomcli/
 */
function getConfigDir() {
  const homeDir = os.homedir();
  return path.join(homeDir, '.atomcli');
}

/**
 * Get the config file path
 * @returns {string} Path to ~/.atomcli/config.json
 */
function getConfigPath() {
  return path.join(getConfigDir(), 'config.json');
}

/**
 * Load launcher configuration
 * @returns {Object} Configuration object
 */
function loadConfig() {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(content);
      return { ...DEFAULT_CONFIG, ...config };
    }
  } catch (err) {
    // Config corrupted or unreadable, use defaults
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Save launcher configuration
 * @param {Object} config - Configuration to save
 */
function saveConfig(config) {
  const configDir = getConfigDir();
  const configPath = getConfigPath();

  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    // Non-fatal: continue without saving
  }
}

/**
 * Update last used app
 * @param {string} appKey - App key (e.g., 'claude')
 */
function updateLastUsed(appKey) {
  const config = loadConfig();
  config.lastUsed = appKey;
  saveConfig(config);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHELL DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect available shell on the system
 * @returns {Object} { shell: string, args: string[] }
 */
function detectShell() {
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    // Try PowerShell Core first
    try {
      execSync('pwsh -v', { stdio: 'pipe' });
      return { shell: 'pwsh', args: ['-NoLogo', '-NoProfile', '-Command'] };
    } catch (e) {}

    // Try Windows PowerShell
    try {
      execSync('powershell -v', { stdio: 'pipe' });
      return { shell: 'powershell', args: ['-NoLogo', '-NoProfile', '-Command'] };
    } catch (e) {}

    // Fall back to cmd
    return { shell: 'cmd', args: ['/c'] };
  }

  // Unix-like systems
  const shell = process.env.SHELL || '/bin/bash';
  return { shell, args: ['-c'] };
}

/**
 * Get shell configuration for launching apps
 * @param {string} [preferredShell='auto'] - Preferred shell
 * @returns {Object} { shell: string, args: string[] }
 */
function getShellConfig(preferredShell = 'auto') {
  if (preferredShell === 'auto') {
    return detectShell();
  }

  const shellConfigs = {
    'pwsh': { shell: 'pwsh', args: ['-NoLogo', '-NoProfile', '-Command'] },
    'powershell': { shell: 'powershell', args: ['-NoLogo', '-NoProfile', '-Command'] },
    'bash': { shell: 'bash', args: ['-c'] },
    'zsh': { shell: 'zsh', args: ['-c'] },
    'fish': { shell: 'fish', args: ['-c'] },
    'cmd': { shell: 'cmd', args: ['/c'] },
    'nu': { shell: 'nu', args: ['-c'] },
  };

  return shellConfigs[preferredShell] || detectShell();
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP LAUNCHING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Find executable path for an app
 * @param {string} appKey - App key (e.g., 'claude')
 * @param {string} [coreDir] - Directory containing built executables
 * @returns {string|null} Path to executable or null if not found
 */
function findExecutable(appKey, coreDir = null) {
  const app = APP_REGISTRY[appKey];
  if (!app) return null;

  const isWindows = process.platform === 'win32';
  const ext = isWindows ? '.exe' : '';

  // Check core directory for built executable
  if (coreDir) {
    const platform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux';
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const binaryName = `${app.executable}-${platform}-${arch}${ext}`;
    const binaryPath = path.join(coreDir, binaryName);

    if (fs.existsSync(binaryPath)) {
      return binaryPath;
    }
  }

  // Check if available in PATH
  try {
    const which = isWindows ? 'where' : 'which';
    const result = execSync(`${which} ${app.executable}`, { stdio: 'pipe' }).toString().trim();
    if (result) {
      return result.split('\n')[0].trim();
    }
  } catch (e) {}

  return null;
}

/**
 * Check if an app is available to launch
 * @param {string} appKey - App key
 * @param {string} [coreDir] - Core directory
 * @returns {Object} { available: boolean, executable: string|null, reason: string }
 */
function checkAppAvailability(appKey, coreDir = null) {
  const app = APP_REGISTRY[appKey];
  if (!app) {
    return { available: false, executable: null, reason: 'Unknown app' };
  }

  const executable = findExecutable(appKey, coreDir);
  if (!executable) {
    return { available: false, executable: null, reason: 'Executable not found' };
  }

  return { available: true, executable, reason: 'Ready' };
}

/**
 * Launch an AI CLI app
 * @param {string} appKey - App key (e.g., 'claude')
 * @param {Object} [options] - Launch options
 * @param {string} [options.coreDir] - Directory containing executables
 * @param {string} [options.shell='auto'] - Shell to use
 * @param {string[]} [options.args=[]] - Additional arguments
 * @param {Object} [options.env={}] - Additional environment variables
 * @param {boolean} [options.detached=false] - Run in detached mode
 * @returns {Promise<Object>} Launch result
 */
async function launchApp(appKey, options = {}) {
  const { coreDir, shell = 'auto', args = [], env = {}, detached = false } = options;

  const app = APP_REGISTRY[appKey];
  if (!app) {
    throw new Error(`Unknown app: ${appKey}`);
  }

  const availability = checkAppAvailability(appKey, coreDir);
  if (!availability.available) {
    throw new Error(`Cannot launch ${app.name}: ${availability.reason}`);
  }

  const executable = availability.executable;
  const shellConfig = getShellConfig(shell);

  // Build environment
  const launchEnv = {
    ...process.env,
    ...env,
  };

  // Update last used
  updateLastUsed(appKey);

  return new Promise((resolve, reject) => {
    const spawnOptions = {
      stdio: detached ? 'ignore' : 'inherit',
      env: launchEnv,
      detached,
      shell: true,
    };

    const fullArgs = [executable, ...args];
    const child = spawn(fullArgs[0], fullArgs.slice(1), spawnOptions);

    if (detached) {
      child.unref();
      resolve({
        success: true,
        app: appKey,
        executable,
        pid: child.pid,
        detached: true,
      });
      return;
    }

    child.on('close', (code) => {
      resolve({
        success: code === 0,
        app: appKey,
        executable,
        exitCode: code,
      });
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MENU RENDERING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Render the launcher menu
 * @param {Object} [options] - Render options
 * @param {string} [options.coreDir] - Core directory to check availability
 * @returns {string} Menu string
 */
function renderLauncherMenu(options = {}) {
  const { coreDir } = options;
  const lines = [];

  lines.push('');
  lines.push('+' + '='.repeat(58) + '+');
  lines.push('|' + ' '.repeat(18) + 'ATOM CLI LAUNCHER' + ' '.repeat(23) + '|');
  lines.push('+' + '='.repeat(58) + '+');
  lines.push('|' + ' '.repeat(58) + '|');

  // App entries
  for (const [key, app] of Object.entries(APP_REGISTRY)) {
    const availability = checkAppAvailability(key, coreDir);
    const status = availability.available ? '  ' : '* ';
    const desc = app.description.substring(0, 30).padEnd(30);
    const line = `|   [${app.hotkey}] ${app.icon} ${app.name.padEnd(16)} - ${desc}|`;
    lines.push(line);
  }

  lines.push('|' + ' '.repeat(58) + '|');
  lines.push('|   [S] Shell Settings   [T] Terminal   [Q] Quit          |');
  lines.push('+' + '='.repeat(58) + '+');
  lines.push('');
  lines.push('  * = Not installed (use Download menu to install)');
  lines.push('');

  return lines.join('\n');
}

/**
 * Get app by hotkey
 * @param {string} hotkey - Hotkey pressed
 * @returns {Object|null} App entry or null
 */
function getAppByHotkey(hotkey) {
  for (const [key, app] of Object.entries(APP_REGISTRY)) {
    if (app.hotkey === hotkey) {
      return { key, ...app };
    }
  }
  return null;
}

/**
 * Get list of all apps with their status
 * @param {string} [coreDir] - Core directory
 * @returns {Object[]} Array of app info
 */
function getApps(coreDir = null) {
  return Object.entries(APP_REGISTRY).map(([key, app]) => {
    const availability = checkAppAvailability(key, coreDir);
    return {
      key,
      ...app,
      available: availability.available,
      executable: availability.executable,
      reason: availability.reason,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Configuration
  DEFAULT_CONFIG,
  APP_REGISTRY,
  loadConfig,
  saveConfig,
  getConfigDir,
  getConfigPath,
  updateLastUsed,

  // Shell detection
  detectShell,
  getShellConfig,

  // App launching
  findExecutable,
  checkAppAvailability,
  launchApp,

  // Menu
  renderLauncherMenu,
  getAppByHotkey,
  getApps,
};
