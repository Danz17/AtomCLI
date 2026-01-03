#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                              ATOMCLI                                          ║
 * ║                    Cross-Platform CLI Build System                            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Rich Terminal UI for building standalone CLI executables                     ║
 * ║                                                                              ║
 * ║  Features:                                                                   ║
 * ║  - LazyGit/Ghostty-style interface                                           ║
 * ║  - Dynamic runtime detection (Node.js, Bun)                                  ║
 * ║  - Multi-platform builds (Windows, Linux, macOS)                             ║
 * ║  - Support for multiple CLI tools (Claude Code, Codex, etc.)                 ║
 * ║                                                                              ║
 * ║  Usage:                                                                      ║
 * ║    node atom.js                                                              ║
 * ║    bun atom.js                                                               ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

const readline = require('readline');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────────────────────────────────────
// Load Components
// ─────────────────────────────────────────────────────────────────────────────

let utils, downloader, builder, launcher, shellRegistry, terminalRegistry, secrets;

try {
  utils = require('./components/utils');
  downloader = require('./components/downloader');
  builder = require('./components/builder');
  launcher = require('./components/launcher');
  shellRegistry = require('./components/shells/registry');
  terminalRegistry = require('./components/terminals/registry');
  secrets = require('./components/secrets');
} catch (err) {
  console.error('Failed to load components:', err.message);
  console.error('Please ensure all component modules exist in ./components/');
  process.exit(1);
}

const { colors, theme, box, log, platform } = utils;

// ─────────────────────────────────────────────────────────────────────────────
// Application State
// ─────────────────────────────────────────────────────────────────────────────

const APP_VERSION = '1.0.0';
const APP_NAME = 'AtomCLI';

const state = {
  selectedMenu: 0,
  currentView: 'main',
  platformInfo: null,
  dependencies: null,
  selectedTool: 'claude-code',
  selectedPlatform: null,
  buildConfig: {
    source: 'npm',
    outputDir: path.join(process.cwd(), 'distro'),
  },
  isRunning: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Terminal Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clear screen and move cursor to top
 */
function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

/**
 * Hide cursor
 */
function hideCursor() {
  process.stdout.write('\x1b[?25l');
}

/**
 * Show cursor
 */
function showCursor() {
  process.stdout.write('\x1b[?25h');
}

/**
 * Move cursor to position
 */
function moveCursor(x, y) {
  process.stdout.write(`\x1b[${y};${x}H`);
}

/**
 * Get terminal size
 */
function getTerminalSize() {
  return {
    width: process.stdout.columns || 80,
    height: process.stdout.rows || 24,
  };
}

/**
 * Center text in given width
 */
function centerText(text, width) {
  const padding = Math.max(0, Math.floor((width - stripAnsi(text).length) / 2));
  return ' '.repeat(padding) + text;
}

/**
 * Strip ANSI codes from string (for length calculation)
 */
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Pad string to width
 */
function padRight(str, width) {
  const len = stripAnsi(str).length;
  return str + ' '.repeat(Math.max(0, width - len));
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draw a box with title
 */
function drawBox(x, y, width, height, title = '', style = 'single') {
  const chars = style === 'double' ? {
    tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║',
  } : {
    tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│',
  };

  const lines = [];

  // Top border
  let top = theme.border(chars.tl + chars.h.repeat(width - 2) + chars.tr);
  if (title) {
    const titleStr = ` ${title} `;
    const titlePos = Math.floor((width - titleStr.length) / 2);
    top = theme.border(chars.tl + chars.h.repeat(titlePos - 1)) +
          theme.accent(titleStr) +
          theme.border(chars.h.repeat(width - titlePos - titleStr.length - 1) + chars.tr);
  }
  lines.push(top);

  // Middle rows
  for (let i = 0; i < height - 2; i++) {
    lines.push(theme.border(chars.v) + ' '.repeat(width - 2) + theme.border(chars.v));
  }

  // Bottom border
  lines.push(theme.border(chars.bl + chars.h.repeat(width - 2) + chars.br));

  // Draw to screen
  lines.forEach((line, i) => {
    moveCursor(x, y + i);
    process.stdout.write(line);
  });

  return { x, y, width, height };
}

/**
 * Write text inside a box
 */
function writeInBox(boxInfo, lineNum, text, align = 'left') {
  const { x, y, width } = boxInfo;
  const maxLen = width - 4;
  let displayText = text;

  if (stripAnsi(text).length > maxLen) {
    displayText = text.substring(0, maxLen - 3) + '...';
  }

  if (align === 'center') {
    displayText = centerText(displayText, maxLen);
  }

  moveCursor(x + 2, y + 1 + lineNum);
  process.stdout.write(padRight(displayText, maxLen));
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu System
// ─────────────────────────────────────────────────────────────────────────────

const MAIN_MENU = [
  { key: '1', label: 'Launch AI CLI', icon: '[>]', action: 'launcher', desc: 'Start an AI coding assistant' },
  { key: '2', label: 'Download Source', icon: '[D]', action: 'download', desc: 'Fetch/update CLI source' },
  { key: '3', label: 'Build Executables', icon: '[B]', action: 'build', desc: 'Compile standalone binaries' },
  { key: '4', label: 'Select CLI Tool', icon: '[T]', action: 'selectTool', desc: 'Choose tool to build' },
  { key: '5', label: 'Platform Builds', icon: '[P]', action: 'platforms', desc: 'Build for specific platforms' },
  { key: '6', label: 'Shell Manager', icon: '[S]', action: 'shells', desc: 'Manage shells (pwsh, bash, etc.)' },
  { key: '7', label: 'Terminal Manager', icon: '[+]', action: 'terminals', desc: 'Manage terminals & TUI tools' },
  { key: '8', label: 'Secrets Manager', icon: '[*]', action: 'secrets', desc: 'Manage API keys & tokens' },
  { key: '9', label: 'System Info', icon: '[i]', action: 'sysinfo', desc: 'View system information' },
  { key: '0', label: 'Settings', icon: '[=]', action: 'settings', desc: 'Configure build options' },
  { key: 'h', label: 'Help', icon: '[?]', action: 'help', desc: 'View documentation' },
  { key: 'q', label: 'Quit', icon: '[x]', action: 'quit', desc: 'Exit AtomCLI' },
];

const TOOL_MENU = [
  { key: '1', id: 'claude-code', label: 'Claude Code', desc: 'AI coding assistant by Anthropic' },
  { key: '2', id: 'codex', label: 'OpenAI Codex', desc: 'AI coding assistant by OpenAI' },
  { key: '3', id: 'copilot', label: 'GitHub Copilot', desc: 'AI coding assistant by GitHub' },
  { key: '4', id: 'gemini', label: 'Google Gemini', desc: 'AI coding assistant by Google' },
  { key: '5', id: 'launcher', label: 'AtomCLI Launcher', desc: 'Universal AI CLI launcher' },
  { key: 'b', label: 'Back', action: 'back' },
];

const PLATFORM_MENU = [
  { key: '1', id: 'windows-x64', label: 'Windows x64', desc: 'Windows 64-bit' },
  { key: '2', id: 'windows-x64-modern', label: 'Windows x64 Modern', desc: 'Windows 64-bit (AVX2)' },
  { key: '3', id: 'linux-x64', label: 'Linux x64', desc: 'Linux 64-bit (glibc)' },
  { key: '4', id: 'linux-x64-musl', label: 'Linux x64 Musl', desc: 'Linux 64-bit (musl/Alpine)' },
  { key: '5', id: 'linux-arm64', label: 'Linux ARM64', desc: 'Linux ARM 64-bit' },
  { key: '6', id: 'macos-x64', label: 'macOS x64', desc: 'macOS Intel' },
  { key: '7', id: 'macos-arm64', label: 'macOS ARM64', desc: 'macOS Apple Silicon' },
  { key: 'a', id: 'all', label: 'Build All', desc: 'Build for all platforms' },
  { key: 'b', label: 'Back', action: 'back' },
];

const LAUNCHER_MENU = [
  { key: '1', id: 'claude', label: 'Claude Code', desc: 'AI by Anthropic' },
  { key: '2', id: 'codex', label: 'OpenAI Codex', desc: 'AI by OpenAI' },
  { key: '3', id: 'copilot', label: 'GitHub Copilot', desc: 'AI by GitHub' },
  { key: '4', id: 'gemini', label: 'Google Gemini', desc: 'AI by Google' },
  { key: 'b', label: 'Back', action: 'back' },
];

const SHELL_MENU = [
  { key: '1', id: 'pwsh', label: 'PowerShell Core', desc: 'Cross-platform modern shell' },
  { key: '2', id: 'bash', label: 'GNU Bash', desc: 'Standard Unix shell' },
  { key: '3', id: 'zsh', label: 'Z Shell', desc: 'Extended Bourne shell' },
  { key: '4', id: 'fish', label: 'Fish Shell', desc: 'User-friendly shell' },
  { key: '5', id: 'clink', label: 'Clink', desc: 'Enhanced Windows cmd' },
  { key: '6', id: 'nushell', label: 'Nushell', desc: 'Modern structured shell' },
  { key: 'b', label: 'Back', action: 'back' },
];

const TERMINAL_MENU = [
  { key: '1', id: 'edex-ui', label: 'eDEX-UI', desc: 'Sci-fi terminal emulator' },
  { key: '2', id: 'ghostty', label: 'Ghostty', desc: 'GPU-accelerated terminal' },
  { key: '3', id: 'lazygit', label: 'Lazygit', desc: 'Git TUI tool' },
  { key: 'b', label: 'Back', action: 'back' },
];

const SECRETS_MENU = [
  { key: '1', id: 'claude', label: 'Anthropic API Key', desc: 'For Claude Code' },
  { key: '2', id: 'openai', label: 'OpenAI API Key', desc: 'For Codex' },
  { key: '3', id: 'github', label: 'GitHub Token', desc: 'For Copilot' },
  { key: '4', id: 'google', label: 'Google API Key', desc: 'For Gemini' },
  { key: 'v', id: 'view', label: 'View Stored Secrets', action: 'viewSecrets' },
  { key: 'b', label: 'Back', action: 'back' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Screen Renderers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render header
 */
function renderHeader() {
  const { width } = getTerminalSize();

  console.log('');
  console.log(centerText(theme.primary('╔══════════════════════════════════════════════════════╗'), width));
  console.log(centerText(theme.primary('║') + theme.accent('            ⚛️  ATOMCLI BUILDER  ⚛️             ') + theme.primary('║'), width));
  console.log(centerText(theme.primary('║') + colors.dim(`     Cross-Platform CLI Build System v${APP_VERSION}     `) + theme.primary('║'), width));
  console.log(centerText(theme.primary('╚══════════════════════════════════════════════════════╝'), width));
  console.log('');
}

/**
 * Render status bar
 */
function renderStatusBar() {
  const { width } = getTerminalSize();
  const { platformInfo, dependencies } = state;

  if (!platformInfo) return;

  const os = platformInfo.osDetails?.name || platformInfo.os;
  const arch = platformInfo.arch;
  const runtime = platformInfo.runtimes.find(r => r.available)?.name || 'none';
  const runtimeVersion = platformInfo.runtimes.find(r => r.available)?.version || '';

  const statusLeft = ` ${colors.cyan('OS:')} ${os} ${colors.dim('|')} ${colors.cyan('Arch:')} ${arch}`;
  const statusRight = `${colors.cyan('Runtime:')} ${runtime} ${runtimeVersion} `;

  const padding = width - stripAnsi(statusLeft).length - stripAnsi(statusRight).length;

  console.log(colors.bgGray(statusLeft + ' '.repeat(Math.max(0, padding)) + statusRight));
}

/**
 * Render main menu
 */
function renderMainMenu() {
  const { width } = getTerminalSize();
  const { selectedMenu } = state;

  console.log('');
  console.log(centerText(colors.bold('Main Menu'), width));
  console.log(centerText(colors.dim('Use number keys or arrows, Enter to select'), width));
  console.log('');

  MAIN_MENU.forEach((item, index) => {
    const isSelected = index === selectedMenu;
    const prefix = isSelected ? theme.accent('▶ ') : '  ';
    const key = colors.yellow(`[${item.key}]`);
    const label = isSelected ? theme.accent(item.label) : item.label;
    const desc = colors.dim(item.desc);

    const line = `${prefix}${key} ${item.icon} ${label}`;
    console.log(centerText(padRight(line, 45) + desc, width + 20));
  });

  console.log('');
}

/**
 * Render tool selection menu
 */
function renderToolMenu() {
  const { width } = getTerminalSize();
  const { selectedMenu, selectedTool } = state;

  console.log('');
  console.log(centerText(colors.bold('Select CLI Tool'), width));
  console.log(centerText(colors.dim('Choose which CLI tool to download and build'), width));
  console.log('');

  TOOL_MENU.forEach((item, index) => {
    const isSelected = index === selectedMenu;
    const isCurrent = item.id === selectedTool;
    const prefix = isSelected ? theme.accent('▶ ') : '  ';
    const key = colors.yellow(`[${item.key}]`);
    const label = isSelected ? theme.accent(item.label) : item.label;
    const current = isCurrent ? colors.green(' (selected)') : '';
    const desc = colors.dim(item.desc || '');

    const line = `${prefix}${key} ${label}${current}`;
    console.log(centerText(padRight(line, 40) + desc, width + 20));
  });

  console.log('');
}

/**
 * Render platform selection menu
 */
function renderPlatformMenu() {
  const { width } = getTerminalSize();
  const { selectedMenu } = state;

  console.log('');
  console.log(centerText(colors.bold('Platform Builds'), width));
  console.log(centerText(colors.dim('Select target platform for building'), width));
  console.log('');

  PLATFORM_MENU.forEach((item, index) => {
    const isSelected = index === selectedMenu;
    const prefix = isSelected ? theme.accent('▶ ') : '  ';
    const key = colors.yellow(`[${item.key}]`);
    const label = isSelected ? theme.accent(item.label) : item.label;
    const desc = colors.dim(item.desc || '');

    const line = `${prefix}${key} ${label}`;
    console.log(centerText(padRight(line, 35) + desc, width + 15));
  });

  console.log('');
}

/**
 * Render system info
 */
function renderSystemInfo() {
  const { width } = getTerminalSize();
  const { platformInfo, dependencies } = state;

  console.log('');
  console.log(centerText(colors.bold('System Information'), width));
  console.log('');

  // Platform info
  console.log(centerText(theme.accent('─── Platform ───'), width));
  console.log(centerText(`${colors.cyan('OS:')} ${platformInfo.osDetails?.pretty || platformInfo.os}`, width));
  console.log(centerText(`${colors.cyan('Architecture:')} ${platformInfo.arch}`, width));
  console.log(centerText(`${colors.cyan('Hostname:')} ${platformInfo.hostname}`, width));
  console.log(centerText(`${colors.cyan('CPU Cores:')} ${platformInfo.cpus}`, width));
  console.log(centerText(`${colors.cyan('Memory:')} ${platformInfo.memory} GB`, width));
  console.log('');

  // Runtimes
  console.log(centerText(theme.accent('─── Runtimes ───'), width));
  platformInfo.runtimes.forEach(rt => {
    const status = rt.available ? colors.green('✓') : colors.red('✗');
    console.log(centerText(`${status} ${rt.name} ${colors.dim(rt.version || 'not installed')}`, width));
  });

  // Add missing runtimes
  const runtimeNames = platformInfo.runtimes.map(r => r.name);
  ['node', 'bun', 'deno'].forEach(name => {
    if (!runtimeNames.includes(name)) {
      console.log(centerText(`${colors.red('✗')} ${name} ${colors.dim('not installed')}`, width));
    }
  });
  console.log('');

  // Dependencies
  console.log(centerText(theme.accent('─── Dependencies ───'), width));
  dependencies.required.forEach(dep => {
    const status = dep.available ? colors.green('✓') : colors.red('✗');
    console.log(centerText(`${status} ${dep.name} ${colors.dim(dep.version || 'missing')} ${colors.yellow('(required)')}`, width));
  });
  dependencies.optional.forEach(dep => {
    const status = dep.available ? colors.green('✓') : colors.dim('○');
    console.log(centerText(`${status} ${dep.name} ${colors.dim(dep.version || 'not found')}`, width));
  });
  console.log('');

  console.log(centerText(colors.dim('Press [b] to go back'), width));
}

/**
 * Render help screen
 */
function renderHelp() {
  const { width } = getTerminalSize();

  console.log('');
  console.log(centerText(colors.bold('AtomCLI Help'), width));
  console.log('');

  console.log(centerText(theme.accent('─── Keyboard Shortcuts ───'), width));
  console.log(centerText(`${colors.yellow('↑/↓')} or ${colors.yellow('j/k')}  Navigate menu`, width));
  console.log(centerText(`${colors.yellow('Enter')}        Select item`, width));
  console.log(centerText(`${colors.yellow('1-9')}          Quick select`, width));
  console.log(centerText(`${colors.yellow('b')}            Go back`, width));
  console.log(centerText(`${colors.yellow('q')}            Quit`, width));
  console.log('');

  console.log(centerText(theme.accent('─── Build Workflow ───'), width));
  console.log(centerText('1. Select CLI Tool (Claude Code, etc.)', width));
  console.log(centerText('2. Download Source from npm', width));
  console.log(centerText('3. Select target platform', width));
  console.log(centerText('4. Build executable', width));
  console.log('');

  console.log(centerText(theme.accent('─── Supported Platforms ───'), width));
  console.log(centerText('Windows: x64, x64-modern (AVX2), x64-baseline', width));
  console.log(centerText('Linux: x64, x64-musl (Alpine), arm64', width));
  console.log(centerText('macOS: x64 (Intel), arm64 (Apple Silicon)', width));
  console.log('');

  console.log(centerText(colors.dim('Press [b] to go back'), width));
}

/**
 * Detect current shell for display
 */
function detectCurrentShell() {
  const isWindows = process.platform === 'win32';
  const userShell = process.env.CLAUDE_SHELL;

  if (userShell) {
    return { shell: userShell, source: 'CLAUDE_SHELL env' };
  }

  if (isWindows) {
    // Check ComSpec for Windows
    const comspec = process.env.COMSPEC || 'cmd.exe';
    const psVersion = process.env.PSModulePath ? 'PowerShell' : null;
    if (psVersion) {
      return { shell: 'powershell.exe', source: 'detected' };
    }
    return { shell: path.basename(comspec), source: 'COMSPEC' };
  } else {
    const shell = process.env.SHELL || '/bin/sh';
    return { shell, source: 'SHELL env' };
  }
}

/**
 * Render settings screen
 */
function renderSettings() {
  const { width } = getTerminalSize();
  const { buildConfig, selectedTool } = state;
  const shellInfo = detectCurrentShell();

  console.log('');
  console.log(centerText(colors.bold('Settings'), width));
  console.log('');

  console.log(centerText(theme.accent('─── Build Configuration ───'), width));
  console.log(centerText(`${colors.cyan('Selected Tool:')} ${selectedTool}`, width));
  console.log(centerText(`${colors.cyan('Source:')} ${buildConfig.source}`, width));
  console.log(centerText(`${colors.cyan('Output Dir:')} ${buildConfig.outputDir}`, width));
  console.log('');

  console.log(centerText(theme.accent('─── Shell Configuration ───'), width));
  console.log(centerText(`${colors.cyan('Current Shell:')} ${shellInfo.shell}`, width));
  console.log(centerText(`${colors.cyan('Detection:')} ${shellInfo.source}`, width));
  console.log('');
  console.log(centerText(colors.dim('Set CLAUDE_SHELL env var to override shell'), width));
  console.log(centerText(colors.dim('e.g., CLAUDE_SHELL=pwsh.exe (Windows)'), width));
  console.log(centerText(colors.dim('      CLAUDE_SHELL=/bin/zsh (Linux/macOS)'), width));
  console.log('');

  console.log(centerText(theme.accent('─── Available Build Targets ───'), width));
  const targets = Object.keys(builder.BUILD_TARGETS);
  const currentTarget = builder.getCurrentTarget();
  const targetLines = [];
  for (let i = 0; i < targets.length; i += 4) {
    const chunk = targets.slice(i, i + 4).map(t =>
      t === currentTarget ? colors.green(`[${t}]`) : colors.dim(t)
    );
    targetLines.push(chunk.join('  '));
  }
  targetLines.forEach(line => console.log(centerText(line, width)));
  console.log('');

  console.log(centerText(colors.dim('Press [b] to go back'), width));
}

/**
 * Render launcher menu
 */
function renderLauncherMenu() {
  const { width } = getTerminalSize();
  const { selectedMenu } = state;
  const coreDir = path.join(process.cwd(), 'core');

  console.log('');
  console.log(centerText(colors.bold('Launch AI CLI'), width));
  console.log(centerText(colors.dim('Select an AI coding assistant to launch'), width));
  console.log('');

  LAUNCHER_MENU.forEach((item, index) => {
    const isSelected = index === selectedMenu;
    const prefix = isSelected ? theme.accent('> ') : '  ';
    const key = colors.yellow(`[${item.key}]`);
    const label = isSelected ? theme.accent(item.label) : item.label;
    const desc = colors.dim(item.desc || '');

    // Check availability if it has an id
    let status = '';
    if (item.id) {
      const appInfo = launcher.checkAppAvailability(item.id, coreDir);
      status = appInfo.available ? colors.green(' [Ready]') : colors.red(' [Not installed]');
    }

    const line = `${prefix}${key} ${label}${status}`;
    console.log(centerText(padRight(line, 45) + desc, width + 20));
  });

  console.log('');
}

/**
 * Render shell manager menu
 */
function renderShellMenu() {
  const { width } = getTerminalSize();
  const { selectedMenu } = state;

  console.log('');
  console.log(centerText(colors.bold('Shell Manager'), width));
  console.log(centerText(colors.dim('View and download shells'), width));
  console.log('');

  SHELL_MENU.forEach((item, index) => {
    const isSelected = index === selectedMenu;
    const prefix = isSelected ? theme.accent('> ') : '  ';
    const key = colors.yellow(`[${item.key}]`);
    const label = isSelected ? theme.accent(item.label) : item.label;
    const desc = colors.dim(item.desc || '');

    // Check availability if it has an id
    let status = '';
    if (item.id) {
      const shellInfo = shellRegistry.checkShellAvailable(item.id);
      status = shellInfo.available ? colors.green(' [Installed]') : colors.dim(' [Not found]');
    }

    const line = `${prefix}${key} ${label}${status}`;
    console.log(centerText(padRight(line, 45) + desc, width + 20));
  });

  console.log('');
}

/**
 * Render terminal manager menu
 */
function renderTerminalMenu() {
  const { width } = getTerminalSize();
  const { selectedMenu } = state;
  const coreDir = path.join(process.cwd(), 'core');

  console.log('');
  console.log(centerText(colors.bold('Terminal Manager'), width));
  console.log(centerText(colors.dim('Manage terminals and TUI tools'), width));
  console.log('');

  TERMINAL_MENU.forEach((item, index) => {
    const isSelected = index === selectedMenu;
    const prefix = isSelected ? theme.accent('> ') : '  ';
    const key = colors.yellow(`[${item.key}]`);
    const label = isSelected ? theme.accent(item.label) : item.label;
    const desc = colors.dim(item.desc || '');

    // Check availability if it has an id
    let status = '';
    if (item.id) {
      const termInfo = terminalRegistry.checkTerminalAvailable(item.id, coreDir);
      status = termInfo.available ? colors.green(' [Available]') : colors.dim(' [Not found]');
    }

    const line = `${prefix}${key} ${label}${status}`;
    console.log(centerText(padRight(line, 45) + desc, width + 20));
  });

  console.log('');
}

/**
 * Render secrets manager menu
 */
function renderSecretsMenu() {
  const { width } = getTerminalSize();
  const { selectedMenu } = state;
  const keychainInfo = secrets.checkKeychainAvailable();

  console.log('');
  console.log(centerText(colors.bold('Secrets Manager'), width));
  console.log(centerText(colors.dim(`Provider: ${keychainInfo.provider}`), width));
  console.log('');

  SECRETS_MENU.forEach((item, index) => {
    const isSelected = index === selectedMenu;
    const prefix = isSelected ? theme.accent('> ') : '  ';
    const key = colors.yellow(`[${item.key}]`);
    const label = isSelected ? theme.accent(item.label) : item.label;
    const desc = colors.dim(item.desc || '');

    // Check if secret is stored
    let status = '';
    if (item.id && item.id !== 'view') {
      const { secret } = secrets.getSecret(item.id);
      status = secret ? colors.green(' [Set]') : colors.dim(' [Not set]');
    }

    const line = `${prefix}${key} ${label}${status}`;
    console.log(centerText(padRight(line, 45) + desc, width + 20));
  });

  console.log('');
  console.log(centerText(colors.dim('Press number to set/update secret, [v] to view, [b] to go back'), width));
}

/**
 * Main render function
 */
function render() {
  clearScreen();
  hideCursor();

  renderHeader();
  renderStatusBar();

  switch (state.currentView) {
    case 'main':
      renderMainMenu();
      break;
    case 'selectTool':
      renderToolMenu();
      break;
    case 'platforms':
      renderPlatformMenu();
      break;
    case 'sysinfo':
      renderSystemInfo();
      break;
    case 'help':
      renderHelp();
      break;
    case 'settings':
      renderSettings();
      break;
    case 'launcher':
      renderLauncherMenu();
      break;
    case 'shells':
      renderShellMenu();
      break;
    case 'terminals':
      renderTerminalMenu();
      break;
    case 'secrets':
      renderSecretsMenu();
      break;
  }

  // Footer
  const { width } = getTerminalSize();
  moveCursor(1, process.stdout.rows - 1);
  console.log(centerText(colors.dim('AtomCLI v' + APP_VERSION + ' | Press ? for help | q to quit'), width));
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Download source files
 */
async function downloadSource(forceDownload = false) {
  clearScreen();
  showCursor();

  log.header(`${forceDownload ? 'Force Downloading' : 'Downloading'} ${state.selectedTool}`);

  const coreDir = path.join(process.cwd(), 'core', state.selectedTool);

  try {
    log.info('Checking for updates...');

    const result = await downloader.downloadTool(state.selectedTool, coreDir, {
      source: state.buildConfig.source,
      force: forceDownload,
      onStatus: (msg) => log.info(msg),
      onProgress: (received, total, percent) => {
        process.stdout.write(`\r${log.progressBar(percent, 100)} ${percent}%`);
      },
    });

    console.log('');

    if (result.skipped) {
      log.success(`${result.name} v${result.version} is already up-to-date!`);
      log.info('No download needed - local version matches remote.');
      log.info(`Local files: ${result.extractDir}`);
      console.log('');
      log.info(colors.dim('Tip: Use "Force Re-download" to download again anyway.'));
    } else {
      log.success(`Successfully downloaded ${result.name} v${result.version}`);
      log.info(`Files extracted to: ${result.extractDir}`);
    }
  } catch (err) {
    log.error(`Download failed: ${err.message}`);
  }

  console.log('');
  log.info('Press any key to continue...');
  await waitForKey();
  render();
}

/**
 * Build executables
 *
 * Builds the selected CLI tool for the selected platform.
 * Passes tool configuration to the builder for tool-specific output names.
 */
async function buildExecutables() {
  clearScreen();
  showCursor();

  // Get tool configuration from CLI_REGISTRY
  const toolConfig = downloader.CLI_REGISTRY[state.selectedTool];
  const toolName = toolConfig?.name || state.selectedTool;

  log.header(`Build ${toolName} Executables`);

  const sourceDir = path.join(process.cwd(), 'core', state.selectedTool, 'package');
  const outputDir = state.buildConfig.outputDir;

  // Check if source exists
  if (!fs.existsSync(sourceDir)) {
    log.error(`Source directory not found: ${sourceDir}`);
    log.info('Please download the source first (option 1)');
    console.log('');
    log.info('Press any key to continue...');
    await waitForKey();
    render();
    return;
  }

  // Check for Bun
  if (!platform.commandExists('bun')) {
    log.error('Bun runtime is required for building');
    log.info('Install Bun: https://bun.sh');
    console.log('');
    log.info('Press any key to continue...');
    await waitForKey();
    render();
    return;
  }

  const targetId = state.selectedPlatform || builder.getCurrentTarget();

  try {
    log.info(`Building ${toolName} for: ${targetId}`);
    log.info(`Source: ${sourceDir}`);
    log.info(`Output: ${outputDir}`);
    console.log('');

    // Pass toolId and toolConfig for tool-specific output names
    const result = await builder.buildTarget(targetId, sourceDir, outputDir, {
      onStatus: (msg) => log.info(msg),
      toolId: state.selectedTool,
      toolConfig: toolConfig,
    });

    log.success(`Build complete: ${result.output}`);
    log.info(`Size: ${result.sizeMB} MB (${result.elapsed})`);
  } catch (err) {
    log.error(`Build failed: ${err.message}`);
  }

  console.log('');
  log.info('Press any key to continue...');
  await waitForKey();
  render();
}

/**
 * Build for specific platform
 *
 * Handles single platform or 'all' platforms build.
 * Uses tool-specific targets from generateBuildTargets().
 */
async function buildForPlatform(platformId) {
  state.selectedPlatform = platformId;

  if (platformId === 'all') {
    // Build all platforms
    clearScreen();
    showCursor();

    const toolConfig = downloader.CLI_REGISTRY[state.selectedTool];
    const toolName = toolConfig?.name || state.selectedTool;

    log.header(`Building ${toolName} for All Platforms`);

    // Use tool-specific targets (or default BUILD_TARGETS)
    const targets = Object.keys(builder.BUILD_TARGET_TEMPLATES);
    for (const target of targets) {
      state.selectedPlatform = target;
      await buildExecutables();
    }
  } else {
    await buildExecutables();
  }
}

/**
 * Wait for any key press
 */
function waitForKey() {
  return new Promise(resolve => {
    // Remove all existing listeners temporarily
    const listeners = process.stdin.listeners('keypress');
    process.stdin.removeAllListeners('keypress');

    process.stdin.setRawMode(true);
    process.stdin.resume();

    process.stdin.once('data', () => {
      // Restore raw mode for menu navigation
      process.stdin.setRawMode(true);

      // Re-add keypress listeners
      listeners.forEach(listener => {
        process.stdin.on('keypress', listener);
      });

      resolve();
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Launcher Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Launch an AI CLI app
 */
async function launchAIApp(appId) {
  const coreDir = path.join(process.cwd(), 'core');

  clearScreen();
  showCursor();

  const apps = launcher.getApps(coreDir);
  const app = apps.find(a => a.key === appId);

  if (!app) {
    log.error(`Unknown app: ${appId}`);
    await waitForKey();
    render();
    return;
  }

  log.header(`Launching ${app.name}`);

  if (!app.available) {
    log.error(`${app.name} is not installed`);
    log.info('Please download and build the tool first');
    console.log('');
    log.info('Press any key to continue...');
    await waitForKey();
    render();
    return;
  }

  log.info(`Executable: ${app.executable}`);
  log.info('Starting...');
  console.log('');

  try {
    // Get secrets as env variables
    const secretEnv = secrets.getSecretsAsEnv();

    await launcher.launchApp(appId, {
      coreDir,
      env: secretEnv,
    });

    log.success('App exited');
  } catch (err) {
    log.error(`Launch failed: ${err.message}`);
  }

  console.log('');
  log.info('Press any key to continue...');
  await waitForKey();
  render();
}

/**
 * Handle shell menu action
 */
async function handleShellAction(shellId) {
  clearScreen();
  showCursor();

  const shellInfo = shellRegistry.checkShellAvailable(shellId);
  const shell = shellRegistry.SHELL_REGISTRY[shellId];

  log.header(`Shell: ${shell?.name || shellId}`);

  if (shellInfo.available) {
    log.success('Status: Installed');
    log.info(`Path: ${shellInfo.path}`);
    log.info(`Version: ${shellInfo.version || 'Unknown'}`);
    log.info(`Source: ${shellInfo.source}`);
  } else {
    log.warning('Status: Not installed');
    log.info(`Reason: ${shellInfo.reason}`);

    // Check if downloadable
    const downloadInfo = shellRegistry.getShellDownloadInfo(shellId);
    if (downloadInfo) {
      log.info('');
      log.info('This shell can be downloaded from GitHub.');
      log.info('Press [d] to download or any other key to go back');

      const key = await waitForKeyWithValue();
      if (key === 'd') {
        try {
          log.info('Downloading...');
          const result = await downloader.downloadShell(shellId, path.join(process.cwd(), 'core'), {
            onStatus: (msg) => log.info(msg),
            onProgress: (received, total, percent) => {
              process.stdout.write(`\r${log.progressBar(percent, 100)} ${percent}%`);
            },
          });
          console.log('');
          log.success(`Downloaded ${result.name} v${result.version}`);
        } catch (err) {
          log.error(`Download failed: ${err.message}`);
        }
      }
    }
  }

  console.log('');
  log.info('Press any key to continue...');
  await waitForKey();
  render();
}

/**
 * Handle terminal menu action
 */
async function handleTerminalAction(terminalId) {
  clearScreen();
  showCursor();

  const coreDir = path.join(process.cwd(), 'core');
  const termInfo = terminalRegistry.checkTerminalAvailable(terminalId, coreDir);
  const terminal = terminalRegistry.TERMINAL_REGISTRY[terminalId];

  log.header(`Terminal: ${terminal?.name || terminalId}`);
  log.info(`Type: ${terminal?.type || 'Unknown'}`);
  log.info(`Description: ${terminal?.description || ''}`);
  console.log('');

  if (termInfo.available) {
    log.success('Status: Available');
    log.info(`Path: ${termInfo.path}`);
    log.info(`Version: ${termInfo.version || 'Unknown'}`);
  } else {
    log.warning('Status: Not found');

    // Check if downloadable
    const downloadInfo = terminalRegistry.getTerminalDownloadInfo(terminalId);
    if (downloadInfo) {
      log.info('');
      log.info('This terminal can be downloaded from GitHub.');
      log.info('Press [d] to download or any other key to go back');

      const key = await waitForKeyWithValue();
      if (key === 'd') {
        try {
          log.info('Downloading...');
          const result = await downloader.downloadTerminal(terminalId, coreDir, {
            onStatus: (msg) => log.info(msg),
            onProgress: (received, total, percent) => {
              process.stdout.write(`\r${log.progressBar(percent, 100)} ${percent}%`);
            },
          });
          console.log('');
          log.success(`Downloaded ${result.name} v${result.version}`);
        } catch (err) {
          log.error(`Download failed: ${err.message}`);
        }
      }
    }
  }

  console.log('');
  log.info('Press any key to continue...');
  await waitForKey();
  render();
}

/**
 * Handle secret menu action (store/update)
 */
async function handleSecretAction(secretType) {
  clearScreen();
  showCursor();

  const secretConfig = secrets.SECRET_TYPES[secretType];
  if (!secretConfig) {
    log.error(`Unknown secret type: ${secretType}`);
    await waitForKey();
    render();
    return;
  }

  log.header(`Set ${secretConfig.label}`);
  log.info(`Environment variable: ${secretConfig.env}`);
  console.log('');

  // Check if already set
  const { secret } = secrets.getSecret(secretType);
  if (secret) {
    log.info('Current: ' + colors.dim('********' + secret.slice(-4)));
    log.info('');
  }

  // Prompt for new value
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  process.stdin.setRawMode(false);

  rl.question('Enter new value (or press Enter to cancel): ', async (value) => {
    rl.close();
    process.stdin.setRawMode(true);

    if (!value.trim()) {
      log.info('Cancelled');
    } else {
      // Validate format
      const validation = secrets.validateSecret(secretType, value.trim());
      if (!validation.valid) {
        log.warning(`Warning: ${validation.reason}`);
      }

      // Store secret
      const result = secrets.storeSecret(secretType, value.trim());
      if (result.success) {
        log.success(`${secretConfig.label} saved using ${result.provider}`);
      } else {
        log.error('Failed to save secret');
      }
    }

    console.log('');
    log.info('Press any key to continue...');
    await waitForKey();
    render();
  });
}

/**
 * View stored secrets
 */
async function viewSecrets() {
  clearScreen();
  showCursor();

  const keychainInfo = secrets.checkKeychainAvailable();

  log.header('Stored Secrets');
  log.info(`Provider: ${keychainInfo.provider}`);
  console.log('');

  for (const [key, config] of Object.entries(secrets.SECRET_TYPES)) {
    const { secret } = secrets.getSecret(key);
    const status = secret
      ? colors.green('[Set] ') + colors.dim('********' + secret.slice(-4))
      : colors.dim('[Not set]');
    console.log(`  ${config.label.padEnd(25)} ${status}`);
  }

  console.log('');
  log.info('Press any key to continue...');
  await waitForKey();
  render();
}

/**
 * Wait for key press and return the key value
 */
function waitForKeyWithValue() {
  return new Promise(resolve => {
    const listeners = process.stdin.listeners('keypress');
    process.stdin.removeAllListeners('keypress');

    process.stdin.setRawMode(true);
    process.stdin.resume();

    process.stdin.once('data', (data) => {
      process.stdin.setRawMode(true);
      listeners.forEach(listener => {
        process.stdin.on('keypress', listener);
      });
      resolve(data.toString());
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Input Handling
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get current menu items based on view
 */
function getCurrentMenu() {
  switch (state.currentView) {
    case 'selectTool':
      return TOOL_MENU;
    case 'platforms':
      return PLATFORM_MENU;
    case 'launcher':
      return LAUNCHER_MENU;
    case 'shells':
      return SHELL_MENU;
    case 'terminals':
      return TERMINAL_MENU;
    case 'secrets':
      return SECRETS_MENU;
    default:
      return MAIN_MENU;
  }
}

/**
 * Handle menu selection
 */
async function handleSelect() {
  const menu = getCurrentMenu();
  const item = menu[state.selectedMenu];

  if (!item) return;

  if (item.action === 'back') {
    state.currentView = 'main';
    state.selectedMenu = 0;
    render();
    return;
  }

  if (item.action === 'quit') {
    shutdown();
    return;
  }

  switch (state.currentView) {
    case 'main':
      switch (item.action) {
        case 'download':
          await downloadSource(false);
          break;
        case 'forceDownload':
          await downloadSource(true);
          break;
        case 'build':
          await buildExecutables();
          break;
        case 'launcher':
        case 'selectTool':
        case 'platforms':
        case 'shells':
        case 'terminals':
        case 'secrets':
        case 'sysinfo':
        case 'help':
        case 'settings':
          state.currentView = item.action;
          state.selectedMenu = 0;
          render();
          break;
      }
      break;

    case 'selectTool':
      if (item.id) {
        state.selectedTool = item.id;
        state.currentView = 'main';
        state.selectedMenu = 0;
        render();
      }
      break;

    case 'platforms':
      if (item.id) {
        await buildForPlatform(item.id);
      }
      break;

    case 'launcher':
      if (item.id) {
        await launchAIApp(item.id);
      }
      break;

    case 'shells':
      if (item.id) {
        await handleShellAction(item.id);
      }
      break;

    case 'terminals':
      if (item.id) {
        await handleTerminalAction(item.id);
      }
      break;

    case 'secrets':
      if (item.id && item.id !== 'view') {
        await handleSecretAction(item.id);
      } else if (item.action === 'viewSecrets') {
        await viewSecrets();
      }
      break;
  }
}

/**
 * Handle key press
 */
async function handleKeyPress(key) {
  const menu = getCurrentMenu();

  // Navigation
  if (key === '\x1b[A' || key === 'k') {
    // Up arrow or k
    state.selectedMenu = Math.max(0, state.selectedMenu - 1);
    render();
    return;
  }

  if (key === '\x1b[B' || key === 'j') {
    // Down arrow or j
    state.selectedMenu = Math.min(menu.length - 1, state.selectedMenu + 1);
    render();
    return;
  }

  // Enter
  if (key === '\r' || key === '\n') {
    await handleSelect();
    return;
  }

  // Quick keys
  const keyItem = menu.find(item => item.key === key);
  if (keyItem) {
    state.selectedMenu = menu.indexOf(keyItem);
    await handleSelect();
    return;
  }

  // Back
  if (key === 'b' && state.currentView !== 'main') {
    state.currentView = 'main';
    state.selectedMenu = 0;
    render();
    return;
  }

  // Help
  if (key === '?') {
    state.currentView = 'help';
    state.selectedMenu = 0;
    render();
    return;
  }

  // Quit
  if (key === 'q' || key === '\x03') {
    shutdown();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Application Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize application
 */
async function init() {
  log.info('Detecting platform...');
  state.platformInfo = platform.detect();

  log.info('Checking dependencies...');
  state.dependencies = platform.checkDependencies();

  // Show welcome if first run
  console.log('');
  log.success('AtomCLI initialized successfully');
  console.log('');
}

/**
 * Shutdown application
 */
function shutdown() {
  state.isRunning = false;
  showCursor();
  clearScreen();
  console.log(theme.primary('Thanks for using AtomCLI!'));
  console.log('');
  process.exit(0);
}

/**
 * Main entry point
 */
async function main() {
  // Setup
  console.log(theme.primary(`
   ╔═══════════════════════════════════════╗
   ║           ⚛️  AtomCLI  ⚛️              ║
   ║    Cross-Platform CLI Build System    ║
   ╚═══════════════════════════════════════╝
  `));

  await init();

  // Wait a moment for user to see init messages
  await new Promise(r => setTimeout(r, 1000));

  // Setup input handling
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.on('keypress', async (str, key) => {
    if (key) {
      const keyStr = key.sequence || str;
      await handleKeyPress(keyStr);
    }
  });

  // Handle resize
  process.stdout.on('resize', () => {
    if (state.isRunning) render();
  });

  // Handle exit
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Initial render
  render();
}

// Run
main().catch(err => {
  console.error('Fatal error:', err);
  showCursor();
  process.exit(1);
});
