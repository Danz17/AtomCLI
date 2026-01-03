/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                         ATOMCLI - INSTALLER MODULE                            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Platform-specific installation utilities                                     ║
 * ║                                                                              ║
 * ║  Features:                                                                   ║
 * ║  - Runtime installation (Bun, Node.js)                                       ║
 * ║  - PATH configuration                                                        ║
 * ║  - Desktop shortcuts                                                         ║
 * ║  - Shell integration                                                         ║
 * ║                                                                              ║
 * ║  Usage:                                                                      ║
 * ║    const installer = require('./components/installer');                       ║
 * ║    await installer.installBun();                                             ║
 * ║    await installer.addToPath('/usr/local/bin/claude');                       ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

// ─────────────────────────────────────────────────────────────────────────────
// Platform Detection
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM = process.platform;
const IS_WINDOWS = PLATFORM === 'win32';
const IS_MACOS = PLATFORM === 'darwin';
const IS_LINUX = PLATFORM === 'linux';
const HOME_DIR = os.homedir();

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute command and return output
 * @param {string} command
 * @param {Object} [options]
 * @returns {string|null}
 */
function execCommand(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options,
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Check if command exists
 * @param {string} command
 * @returns {boolean}
 */
function commandExists(command) {
  const check = IS_WINDOWS ? `where ${command}` : `which ${command}`;
  return execCommand(check) !== null;
}

/**
 * Check if running as administrator/root
 * @returns {boolean}
 */
function isElevated() {
  if (IS_WINDOWS) {
    try {
      execSync('net session', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
  return process.getuid?.() === 0;
}

/**
 * Download file to destination
 * @param {string} url
 * @param {string} destPath
 * @returns {Promise<void>}
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Prerequisites Check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check all prerequisites for building
 * @returns {Object}
 */
function checkPrerequisites() {
  const result = {
    canBuild: false,
    missing: [],
    available: [],
    recommendations: [],
  };

  // Check for Bun (required for building)
  if (commandExists('bun')) {
    result.available.push({
      name: 'bun',
      version: execCommand('bun --version'),
      required: true,
    });
  } else {
    result.missing.push({
      name: 'bun',
      required: true,
      installUrl: 'https://bun.sh',
    });
    result.recommendations.push('Install Bun: https://bun.sh');
  }

  // Check for Git
  if (commandExists('git')) {
    result.available.push({
      name: 'git',
      version: execCommand('git --version')?.match(/[\d.]+/)?.[0],
      required: true,
    });
  } else {
    result.missing.push({
      name: 'git',
      required: true,
      installUrl: 'https://git-scm.com',
    });
    result.recommendations.push('Install Git: https://git-scm.com');
  }

  // Check for tar
  if (commandExists('tar')) {
    result.available.push({
      name: 'tar',
      version: 'available',
      required: false,
    });
  }

  // Check for curl
  if (commandExists('curl')) {
    result.available.push({
      name: 'curl',
      version: 'available',
      required: false,
    });
  }

  // Determine if we can build
  result.canBuild = !result.missing.some(m => m.required);

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bun Installation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Install Bun runtime
 * @param {Object} [options]
 * @param {Function} [options.onStatus] - Status callback
 * @returns {Promise<Object>}
 */
async function installBun(options = {}) {
  const { onStatus } = options;

  if (commandExists('bun')) {
    const version = execCommand('bun --version');
    return {
      success: true,
      alreadyInstalled: true,
      version,
      message: `Bun ${version} is already installed`,
    };
  }

  onStatus?.('Installing Bun runtime...');

  try {
    if (IS_WINDOWS) {
      // Windows: Use PowerShell installer
      onStatus?.('Running Bun installer for Windows...');
      execSync('powershell -c "irm bun.sh/install.ps1 | iex"', {
        stdio: 'inherit',
        shell: true,
      });
    } else {
      // Unix: Use curl installer
      onStatus?.('Running Bun installer for Unix...');
      execSync('curl -fsSL https://bun.sh/install | bash', {
        stdio: 'inherit',
        shell: true,
      });
    }

    // Verify installation
    const bunPath = IS_WINDOWS
      ? path.join(HOME_DIR, '.bun', 'bin', 'bun.exe')
      : path.join(HOME_DIR, '.bun', 'bin', 'bun');

    if (fs.existsSync(bunPath)) {
      const version = execCommand(`"${bunPath}" --version`);
      return {
        success: true,
        alreadyInstalled: false,
        version,
        path: bunPath,
        message: `Bun ${version} installed successfully`,
        needsPathUpdate: true,
      };
    } else {
      throw new Error('Bun binary not found after installation');
    }
  } catch (err) {
    return {
      success: false,
      error: err.message,
      message: `Failed to install Bun: ${err.message}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATH Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add directory to system PATH
 * @param {string} dir - Directory to add
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
async function addToPath(dir, options = {}) {
  const { onStatus, permanent = true } = options;

  if (!fs.existsSync(dir)) {
    return {
      success: false,
      message: `Directory does not exist: ${dir}`,
    };
  }

  onStatus?.(`Adding ${dir} to PATH...`);

  try {
    if (IS_WINDOWS) {
      return await addToPathWindows(dir, permanent);
    } else {
      return await addToPathUnix(dir, permanent);
    }
  } catch (err) {
    return {
      success: false,
      error: err.message,
      message: `Failed to add to PATH: ${err.message}`,
    };
  }
}

/**
 * Add directory to Windows PATH
 * @param {string} dir
 * @param {boolean} permanent
 * @returns {Promise<Object>}
 */
async function addToPathWindows(dir, permanent) {
  // Check if already in PATH
  const currentPath = process.env.PATH || '';
  if (currentPath.split(';').includes(dir)) {
    return {
      success: true,
      alreadyInPath: true,
      message: `${dir} is already in PATH`,
    };
  }

  if (permanent) {
    // Add to user PATH permanently
    const cmd = `[Environment]::SetEnvironmentVariable("PATH", [Environment]::GetEnvironmentVariable("PATH", "User") + ";${dir}", "User")`;
    execSync(`powershell -Command "${cmd}"`, { stdio: 'pipe' });
  }

  // Add to current process PATH
  process.env.PATH = `${dir};${currentPath}`;

  return {
    success: true,
    permanent,
    message: permanent
      ? `Added ${dir} to PATH permanently. Restart your terminal to apply.`
      : `Added ${dir} to PATH for this session`,
  };
}

/**
 * Add directory to Unix PATH
 * @param {string} dir
 * @param {boolean} permanent
 * @returns {Promise<Object>}
 */
async function addToPathUnix(dir, permanent) {
  // Check if already in PATH
  const currentPath = process.env.PATH || '';
  if (currentPath.split(':').includes(dir)) {
    return {
      success: true,
      alreadyInPath: true,
      message: `${dir} is already in PATH`,
    };
  }

  if (permanent) {
    // Determine shell config file
    const shell = process.env.SHELL || '/bin/bash';
    let configFile;

    if (shell.includes('zsh')) {
      configFile = path.join(HOME_DIR, '.zshrc');
    } else if (shell.includes('fish')) {
      configFile = path.join(HOME_DIR, '.config', 'fish', 'config.fish');
    } else {
      configFile = path.join(HOME_DIR, '.bashrc');
    }

    // Add export line
    const exportLine = `\n# Added by AtomCLI\nexport PATH="${dir}:$PATH"\n`;

    // Check if already added
    if (fs.existsSync(configFile)) {
      const content = fs.readFileSync(configFile, 'utf8');
      if (content.includes(dir)) {
        return {
          success: true,
          alreadyInPath: true,
          message: `${dir} is already configured in ${configFile}`,
        };
      }
    }

    fs.appendFileSync(configFile, exportLine);
  }

  // Add to current process PATH
  process.env.PATH = `${dir}:${currentPath}`;

  return {
    success: true,
    permanent,
    message: permanent
      ? `Added ${dir} to PATH permanently. Run 'source ~/.bashrc' or restart terminal.`
      : `Added ${dir} to PATH for this session`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Executable Installation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Install executable to system location
 * @param {string} sourcePath - Source executable path
 * @param {string} name - Name for the installed executable
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
async function installExecutable(sourcePath, name, options = {}) {
  const { onStatus, createShortcut = true } = options;

  if (!fs.existsSync(sourcePath)) {
    return {
      success: false,
      message: `Source file does not exist: ${sourcePath}`,
    };
  }

  onStatus?.(`Installing ${name}...`);

  try {
    let installDir;
    let execName;

    if (IS_WINDOWS) {
      // Windows: Install to AppData\Local\Programs
      installDir = path.join(HOME_DIR, 'AppData', 'Local', 'Programs', 'AtomCLI');
      execName = name.endsWith('.exe') ? name : `${name}.exe`;
    } else if (IS_MACOS) {
      // macOS: Install to /usr/local/bin or ~/bin
      installDir = isElevated() ? '/usr/local/bin' : path.join(HOME_DIR, 'bin');
      execName = name;
    } else {
      // Linux: Install to /usr/local/bin or ~/.local/bin
      installDir = isElevated() ? '/usr/local/bin' : path.join(HOME_DIR, '.local', 'bin');
      execName = name;
    }

    // Ensure install directory exists
    if (!fs.existsSync(installDir)) {
      fs.mkdirSync(installDir, { recursive: true });
    }

    const destPath = path.join(installDir, execName);

    // Copy executable
    fs.copyFileSync(sourcePath, destPath);

    // Make executable on Unix
    if (!IS_WINDOWS) {
      fs.chmodSync(destPath, 0o755);
    }

    // Add to PATH if needed
    const pathResult = await addToPath(installDir, { onStatus });

    // Create desktop shortcut on Windows
    let shortcutPath = null;
    if (IS_WINDOWS && createShortcut) {
      shortcutPath = await createWindowsShortcut(destPath, name, options);
    }

    return {
      success: true,
      path: destPath,
      installDir,
      pathUpdated: pathResult.success && !pathResult.alreadyInPath,
      shortcut: shortcutPath,
      message: `Installed ${name} to ${destPath}`,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      message: `Failed to install ${name}: ${err.message}`,
    };
  }
}

/**
 * Create Windows shortcut
 * @param {string} targetPath
 * @param {string} name
 * @param {Object} [options]
 * @returns {Promise<string|null>}
 */
async function createWindowsShortcut(targetPath, name, options = {}) {
  if (!IS_WINDOWS) return null;

  try {
    const desktopPath = path.join(HOME_DIR, 'Desktop');
    const shortcutPath = path.join(desktopPath, `${name}.lnk`);

    const psScript = `
      $WshShell = New-Object -ComObject WScript.Shell
      $Shortcut = $WshShell.CreateShortcut("${shortcutPath.replace(/\\/g, '\\\\')}")
      $Shortcut.TargetPath = "${targetPath.replace(/\\/g, '\\\\')}"
      $Shortcut.Save()
    `;

    execSync(`powershell -Command "${psScript}"`, { stdio: 'pipe' });
    return shortcutPath;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Uninstallation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uninstall executable
 * @param {string} name - Executable name
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
async function uninstallExecutable(name, options = {}) {
  const { onStatus } = options;

  onStatus?.(`Uninstalling ${name}...`);

  try {
    const possibleLocations = [];

    if (IS_WINDOWS) {
      const execName = name.endsWith('.exe') ? name : `${name}.exe`;
      possibleLocations.push(
        path.join(HOME_DIR, 'AppData', 'Local', 'Programs', 'AtomCLI', execName),
        path.join(HOME_DIR, '.local', 'bin', execName)
      );
    } else {
      possibleLocations.push(
        `/usr/local/bin/${name}`,
        path.join(HOME_DIR, '.local', 'bin', name),
        path.join(HOME_DIR, 'bin', name)
      );
    }

    let removed = 0;
    const removedPaths = [];

    for (const loc of possibleLocations) {
      if (fs.existsSync(loc)) {
        fs.unlinkSync(loc);
        removedPaths.push(loc);
        removed++;
      }
    }

    // Remove desktop shortcut on Windows
    if (IS_WINDOWS) {
      const shortcutPath = path.join(HOME_DIR, 'Desktop', `${name}.lnk`);
      if (fs.existsSync(shortcutPath)) {
        fs.unlinkSync(shortcutPath);
      }
    }

    return {
      success: removed > 0,
      removed,
      paths: removedPaths,
      message: removed > 0
        ? `Removed ${name} from ${removed} location(s)`
        : `${name} was not found in expected locations`,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      message: `Failed to uninstall ${name}: ${err.message}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell Integration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add shell completion scripts
 * @param {string} name - Command name
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
async function installShellCompletion(name, options = {}) {
  const { onStatus } = options;

  if (IS_WINDOWS) {
    return {
      success: true,
      message: 'Shell completion not needed on Windows',
    };
  }

  onStatus?.('Installing shell completion...');

  const shell = process.env.SHELL || '/bin/bash';
  let completionDir;
  let completionContent;

  if (shell.includes('zsh')) {
    completionDir = path.join(HOME_DIR, '.zsh', 'completions');
    completionContent = `#compdef ${name}\n_${name}() {\n  local commands=("download" "build" "install" "help")\n  _describe 'command' commands\n}\n_${name}`;
  } else if (shell.includes('bash')) {
    completionDir = path.join(HOME_DIR, '.local', 'share', 'bash-completion', 'completions');
    completionContent = `_${name}() {\n  local commands="download build install help"\n  COMPREPLY=($(compgen -W "$commands" -- "\${COMP_WORDS[COMP_CWORD]}"))\n}\ncomplete -F _${name} ${name}`;
  } else {
    return {
      success: true,
      message: 'Shell completion not available for your shell',
    };
  }

  try {
    if (!fs.existsSync(completionDir)) {
      fs.mkdirSync(completionDir, { recursive: true });
    }

    const completionFile = path.join(completionDir, `_${name}`);
    fs.writeFileSync(completionFile, completionContent);

    return {
      success: true,
      path: completionFile,
      message: `Shell completion installed. Restart your terminal to enable.`,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      message: `Failed to install completion: ${err.message}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Prerequisites
  checkPrerequisites,

  // Bun installation
  installBun,

  // PATH management
  addToPath,

  // Executable installation
  installExecutable,
  uninstallExecutable,

  // Shell integration
  installShellCompletion,

  // Utilities
  commandExists,
  isElevated,
  downloadFile,

  // Platform info
  PLATFORM,
  IS_WINDOWS,
  IS_MACOS,
  IS_LINUX,
  HOME_DIR,
};
