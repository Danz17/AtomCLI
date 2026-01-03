#!/usr/bin/env node
/**
 * ============================================================================
 *                    ATOMCLI - STANDALONE LAUNCHER CLI
 * ============================================================================
 *  Cross-platform executable entry point for the AtomCLI Launcher
 *
 *  This file is compiled into a standalone executable using Bun that can
 *  be distributed and run on Windows, Linux, and macOS without any
 *  additional dependencies.
 *
 *  Usage:
 *    ./launcher-windows-x64.exe   (Windows)
 *    ./launcher-linux-x64         (Linux)
 *    ./launcher-macos-arm64       (macOS)
 * ============================================================================
 */

'use strict';

const readline = require('readline');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Import launcher module
const launcher = require('./index.js');

// Try to import secrets module (may not be available in all builds)
let secrets = null;
try {
  secrets = require('../secrets');
} catch (e) {
  // Secrets module not available, continue without it
}

// ============================================================================
// COLORS
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// ============================================================================
// MENU RENDERING
// ============================================================================

/**
 * Clear the terminal screen
 */
function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

/**
 * Render the launcher header
 */
function renderHeader() {
  const lines = [
    '',
    `${colors.cyan}+${'='.repeat(60)}+${colors.reset}`,
    `${colors.cyan}|${colors.reset}${colors.bold}                    ATOM CLI LAUNCHER                      ${colors.reset}${colors.cyan}|${colors.reset}`,
    `${colors.cyan}+${'='.repeat(60)}+${colors.reset}`,
    '',
  ];
  return lines.join('\n');
}

/**
 * Render the app menu
 * @param {string} [coreDir] - Directory containing built executables
 */
function renderAppMenu(coreDir = null) {
  const apps = launcher.getApps(coreDir);
  const lines = [];

  for (const app of apps) {
    const status = app.available ? `${colors.green}+${colors.reset}` : `${colors.red}*${colors.reset}`;
    const desc = app.description.substring(0, 32).padEnd(32);
    lines.push(`   [${colors.cyan}${app.hotkey}${colors.reset}] ${app.icon} ${app.name.padEnd(18)} ${colors.dim}${desc}${colors.reset}`);
  }

  lines.push('');
  lines.push(`   [${colors.yellow}q${colors.reset}] Quit`);
  lines.push('');
  lines.push(`   ${colors.dim}* = Not installed${colors.reset}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Render the full menu
 */
function renderFullMenu(coreDir = null) {
  return renderHeader() + renderAppMenu(coreDir);
}

// ============================================================================
// INPUT HANDLING
// ============================================================================

/**
 * Handle user input for app selection
 * @param {string} input - User input character
 * @param {Object} options - Launch options
 * @returns {Promise<boolean>} - True if should continue, false to exit
 */
async function handleInput(input, options = {}) {
  const key = input.toLowerCase().trim();

  // Quit
  if (key === 'q' || key === '\x03') { // q or Ctrl+C
    return false;
  }

  // Check if it's an app hotkey
  const app = launcher.getAppByHotkey(key);
  if (app) {
    const availability = launcher.checkAppAvailability(app.key, options.coreDir);

    if (!availability.available) {
      console.log(`\n${colors.red}Error:${colors.reset} ${app.name} is not installed.`);
      console.log(`${colors.dim}Use the AtomCLI download menu to install it.${colors.reset}\n`);
      await waitForKey('Press any key to continue...');
      return true;
    }

    // Get environment variables (including API keys from secrets)
    let env = { ...process.env };
    if (secrets) {
      try {
        const secretsEnv = await secrets.getSecretsAsEnv();
        env = { ...env, ...secretsEnv };
      } catch (e) {
        // Continue without secrets
      }
    }

    console.log(`\n${colors.green}Launching ${app.name}...${colors.reset}\n`);

    try {
      // Launch the app with inherited stdio
      await launcher.launchApp(app.key, {
        coreDir: options.coreDir,
        env,
      });
    } catch (err) {
      console.log(`\n${colors.red}Error launching ${app.name}:${colors.reset} ${err.message}\n`);
      await waitForKey('Press any key to continue...');
    }

    return true;
  }

  return true;
}

/**
 * Wait for a keypress
 * @param {string} prompt - Prompt to display
 */
function waitForKey(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      console.log('');
      resolve();
    });
  });
}

// ============================================================================
// MAIN LOOP
// ============================================================================

/**
 * Run the interactive menu loop
 */
async function runMenuLoop(options = {}) {
  const { coreDir } = options;

  // Set up raw mode for single keypress detection
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  let running = true;

  while (running) {
    clearScreen();
    console.log(renderFullMenu(coreDir));
    process.stdout.write(`${colors.cyan}Select an option:${colors.reset} `);

    // Wait for single keypress
    const key = await new Promise((resolve) => {
      process.stdin.once('data', (data) => {
        resolve(data);
      });
    });

    running = await handleInput(key, { coreDir });
  }

  // Clean up
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.stdin.pause();

  console.log(`\n${colors.dim}Goodbye!${colors.reset}\n`);
}

// ============================================================================
// DIRECT LAUNCH MODE
// ============================================================================

/**
 * Launch an app directly by name (skipping the menu)
 * @param {string} appName - App name or key
 * @param {string} [coreDir] - Directory containing executables
 */
async function directLaunch(appName, coreDir = null) {
  const appKey = appName.toLowerCase();
  const app = launcher.APP_REGISTRY[appKey];

  if (!app) {
    console.error(`${colors.red}Error:${colors.reset} Unknown app '${appName}'`);
    console.log(`Available apps: ${Object.keys(launcher.APP_REGISTRY).join(', ')}`);
    process.exit(1);
  }

  // Get environment variables
  let env = { ...process.env };
  if (secrets) {
    try {
      const secretsEnv = await secrets.getSecretsAsEnv();
      env = { ...env, ...secretsEnv };
    } catch (e) {
      // Continue without secrets
    }
  }

  try {
    await launcher.launchApp(appKey, { env, coreDir });
  } catch (err) {
    console.error(`${colors.red}Error:${colors.reset} ${err.message}`);
    process.exit(1);
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

async function main() {
  // Auto-detect core directory (where other executables are)
  // When compiled, __dirname is the directory containing the launcher executable
  const coreDir = path.dirname(process.execPath);

  // Parse command line arguments
  const args = process.argv.slice(2);

  // Help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${colors.cyan}AtomCLI Launcher${colors.reset} - Universal AI CLI Launcher

${colors.bold}Usage:${colors.reset}
  launcher                     Show interactive menu
  launcher <app>               Launch app directly
  launcher --list              List available apps
  launcher --help              Show this help

${colors.bold}Apps:${colors.reset}
  claude    - Claude Code (Anthropic)
  codex     - OpenAI Codex
  copilot   - GitHub Copilot
  gemini    - Google Gemini

${colors.bold}Examples:${colors.reset}
  launcher claude              Launch Claude Code directly
  launcher                     Show menu to select app
`);
    process.exit(0);
  }

  // List apps
  if (args.includes('--list') || args.includes('-l')) {
    console.log(`\n${colors.cyan}Available Apps:${colors.reset}\n`);
    const apps = launcher.getApps(coreDir);
    for (const app of apps) {
      const status = app.available ? `${colors.green}installed${colors.reset}` : `${colors.yellow}not installed${colors.reset}`;
      console.log(`  ${app.key.padEnd(10)} ${app.name.padEnd(20)} [${status}]`);
    }
    console.log('');
    process.exit(0);
  }

  // Direct launch mode
  if (args.length > 0 && !args[0].startsWith('-')) {
    await directLaunch(args[0], coreDir);
    return;
  }

  // Interactive menu mode
  try {
    await runMenuLoop({ coreDir });
  } catch (err) {
    // Handle Ctrl+C gracefully
    if (err.code === 'ERR_USE_AFTER_CLOSE') {
      process.exit(0);
    }
    throw err;
  }
}

// Run main
main().catch((err) => {
  console.error(`${colors.red}Fatal error:${colors.reset} ${err.message}`);
  process.exit(1);
});
