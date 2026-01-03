/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                    ATOMCLI - LAUNCHER & COMPONENTS TESTS                     ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Tests for launcher, shells, terminals, and secrets modules                  ║
 * ║                                                                              ║
 * ║  Validates:                                                                  ║
 * ║  - Launcher module exports and APP_REGISTRY                                  ║
 * ║  - Shell registry and detection                                              ║
 * ║  - Terminal registry and detection                                           ║
 * ║  - Secrets manager functionality                                             ║
 * ║                                                                              ║
 * ║  Usage:                                                                      ║
 * ║    node scripts/test/test-launcher.cjs                                       ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const ROOT_DIR = path.resolve(__dirname, '../..');
const LAUNCHER_PATH = path.join(ROOT_DIR, 'components', 'launcher');
const SHELLS_PATH = path.join(ROOT_DIR, 'components', 'shells', 'registry');
const TERMINALS_PATH = path.join(ROOT_DIR, 'components', 'terminals', 'registry');
const SECRETS_PATH = path.join(ROOT_DIR, 'components', 'secrets');

// ═══════════════════════════════════════════════════════════════════════════════
// TEST FRAMEWORK
// ═══════════════════════════════════════════════════════════════════════════════

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ${colors.green}+${colors.reset} ${message}`);
    passed++;
  } else {
    console.log(`  ${colors.red}x${colors.reset} ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  const match = actual === expected;
  if (match) {
    console.log(`  ${colors.green}+${colors.reset} ${message}`);
    passed++;
  } else {
    console.log(`  ${colors.red}x${colors.reset} ${message}`);
    console.log(`    ${colors.dim}Expected: ${expected}${colors.reset}`);
    console.log(`    ${colors.dim}Actual:   ${actual}${colors.reset}`);
    failed++;
  }
}

function assertExists(value, message) {
  assert(value !== undefined && value !== null, message);
}

function assertType(value, type, message) {
  assert(typeof value === type, message);
}

function section(title) {
  console.log(`\n${colors.cyan}> ${title}${colors.reset}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAUNCHER TESTS
// ═══════════════════════════════════════════════════════════════════════════════

function testLauncherModule() {
  section('Launcher Module');

  const launcher = require(LAUNCHER_PATH);

  // Test exports
  assertExists(launcher.APP_REGISTRY, 'APP_REGISTRY is exported');
  assertExists(launcher.DEFAULT_CONFIG, 'DEFAULT_CONFIG is exported');
  assertExists(launcher.loadConfig, 'loadConfig is exported');
  assertExists(launcher.saveConfig, 'saveConfig is exported');
  assertExists(launcher.detectShell, 'detectShell is exported');
  assertExists(launcher.getShellConfig, 'getShellConfig is exported');
  assertExists(launcher.findExecutable, 'findExecutable is exported');
  assertExists(launcher.checkAppAvailability, 'checkAppAvailability is exported');
  assertExists(launcher.launchApp, 'launchApp is exported');
  assertExists(launcher.renderLauncherMenu, 'renderLauncherMenu is exported');
  assertExists(launcher.getAppByHotkey, 'getAppByHotkey is exported');
  assertExists(launcher.getApps, 'getApps is exported');
}

function testAppRegistry() {
  section('APP_REGISTRY');

  const launcher = require(LAUNCHER_PATH);
  const registry = launcher.APP_REGISTRY;

  // Test expected apps exist
  const expectedApps = ['claude', 'codex', 'copilot', 'gemini'];

  for (const appId of expectedApps) {
    assertExists(registry[appId], `App '${appId}' exists in registry`);

    if (registry[appId]) {
      assertExists(registry[appId].name, `${appId} has name`);
      assertExists(registry[appId].executable, `${appId} has executable`);
      assertExists(registry[appId].hotkey, `${appId} has hotkey`);
      assertExists(registry[appId].envKey, `${appId} has envKey`);
    }
  }
}

function testShellDetection() {
  section('Shell Detection');

  const launcher = require(LAUNCHER_PATH);

  const shellConfig = launcher.detectShell();
  assertExists(shellConfig, 'detectShell returns a config');
  assertExists(shellConfig.shell, 'Shell config has shell property');
  assertExists(shellConfig.args, 'Shell config has args property');

  // Test getShellConfig with different values
  const autoConfig = launcher.getShellConfig('auto');
  assertExists(autoConfig, 'getShellConfig(auto) returns config');

  const pwshConfig = launcher.getShellConfig('pwsh');
  assertEqual(pwshConfig.shell, 'pwsh', 'getShellConfig(pwsh) returns pwsh');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHELL REGISTRY TESTS
// ═══════════════════════════════════════════════════════════════════════════════

function testShellRegistry() {
  section('Shell Registry');

  const shellRegistry = require(SHELLS_PATH);

  // Test exports
  assertExists(shellRegistry.SHELL_REGISTRY, 'SHELL_REGISTRY is exported');
  assertExists(shellRegistry.getPlatformKey, 'getPlatformKey is exported');
  assertExists(shellRegistry.checkShellAvailable, 'checkShellAvailable is exported');
  assertExists(shellRegistry.getAvailableShells, 'getAvailableShells is exported');
  assertExists(shellRegistry.getShellRunConfig, 'getShellRunConfig is exported');
  assertExists(shellRegistry.getDownloadableShells, 'getDownloadableShells is exported');
}

function testShellEntries() {
  section('Shell Entries');

  const shellRegistry = require(SHELLS_PATH);
  const registry = shellRegistry.SHELL_REGISTRY;

  // Test expected shells exist
  const expectedShells = ['pwsh', 'bash', 'zsh', 'fish', 'clink', 'nushell'];

  for (const shellId of expectedShells) {
    assertExists(registry[shellId], `Shell '${shellId}' exists in registry`);

    if (registry[shellId]) {
      assertExists(registry[shellId].name, `${shellId} has name`);
      assertExists(registry[shellId].description, `${shellId} has description`);
      assertExists(registry[shellId].executable, `${shellId} has executable`);
    }
  }
}

function testShellAvailability() {
  section('Shell Availability Check');

  const shellRegistry = require(SHELLS_PATH);

  // Test checkShellAvailable returns proper structure
  const bashCheck = shellRegistry.checkShellAvailable('bash');
  assertExists(bashCheck, 'checkShellAvailable returns result');
  assert('available' in bashCheck, 'Result has available property');
  assert('path' in bashCheck, 'Result has path property');

  // Test unknown shell
  const unknownCheck = shellRegistry.checkShellAvailable('nonexistent-shell');
  assertEqual(unknownCheck.available, false, 'Unknown shell returns not available');
}

// ═══════════════════════════════════════════════════════════════════════════════
// TERMINAL REGISTRY TESTS
// ═══════════════════════════════════════════════════════════════════════════════

function testTerminalRegistry() {
  section('Terminal Registry');

  const terminalRegistry = require(TERMINALS_PATH);

  // Test exports
  assertExists(terminalRegistry.TERMINAL_REGISTRY, 'TERMINAL_REGISTRY is exported');
  assertExists(terminalRegistry.getPlatformKey, 'getPlatformKey is exported');
  assertExists(terminalRegistry.checkTerminalAvailable, 'checkTerminalAvailable is exported');
  assertExists(terminalRegistry.getAvailableTerminals, 'getAvailableTerminals is exported');
  assertExists(terminalRegistry.getDownloadableTerminals, 'getDownloadableTerminals is exported');
  assertExists(terminalRegistry.getTerminalRunCommand, 'getTerminalRunCommand is exported');
}

function testTerminalEntries() {
  section('Terminal Entries');

  const terminalRegistry = require(TERMINALS_PATH);
  const registry = terminalRegistry.TERMINAL_REGISTRY;

  // Test expected terminals exist
  const expectedTerminals = ['edex-ui', 'ghostty', 'lazygit'];

  for (const termId of expectedTerminals) {
    assertExists(registry[termId], `Terminal '${termId}' exists in registry`);

    if (registry[termId]) {
      assertExists(registry[termId].name, `${termId} has name`);
      assertExists(registry[termId].description, `${termId} has description`);
      assertExists(registry[termId].type, `${termId} has type`);
      assertExists(registry[termId].github, `${termId} has github`);
    }
  }
}

function testTerminalTypes() {
  section('Terminal Types');

  const terminalRegistry = require(TERMINALS_PATH);
  const registry = terminalRegistry.TERMINAL_REGISTRY;

  // Test terminal types
  assertEqual(registry['edex-ui'].type, 'terminal_emulator', 'eDEX-UI is terminal_emulator');
  assertEqual(registry['ghostty'].type, 'terminal_emulator', 'Ghostty is terminal_emulator');
  assertEqual(registry['lazygit'].type, 'tui_tool', 'Lazygit is tui_tool');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECRETS MANAGER TESTS
// ═══════════════════════════════════════════════════════════════════════════════

function testSecretsModule() {
  section('Secrets Module');

  const secrets = require(SECRETS_PATH);

  // Test exports
  assertExists(secrets.SECRET_TYPES, 'SECRET_TYPES is exported');
  assertExists(secrets.getProvider, 'getProvider is exported');
  assertExists(secrets.checkKeychainAvailable, 'checkKeychainAvailable is exported');
  assertExists(secrets.storeSecret, 'storeSecret is exported');
  assertExists(secrets.getSecret, 'getSecret is exported');
  assertExists(secrets.deleteSecret, 'deleteSecret is exported');
  assertExists(secrets.listSecrets, 'listSecrets is exported');
  assertExists(secrets.getSecretsAsEnv, 'getSecretsAsEnv is exported');
  assertExists(secrets.validateSecret, 'validateSecret is exported');
}

function testSecretTypes() {
  section('Secret Types');

  const secrets = require(SECRETS_PATH);
  const types = secrets.SECRET_TYPES;

  // Test expected secret types
  const expectedTypes = ['claude', 'openai', 'github', 'google'];

  for (const typeId of expectedTypes) {
    assertExists(types[typeId], `Secret type '${typeId}' exists`);

    if (types[typeId]) {
      assertExists(types[typeId].service, `${typeId} has service`);
      assertExists(types[typeId].env, `${typeId} has env`);
      assertExists(types[typeId].label, `${typeId} has label`);
    }
  }

  // Test specific env mappings
  assertEqual(types['claude'].env, 'ANTHROPIC_API_KEY', 'Claude maps to ANTHROPIC_API_KEY');
  assertEqual(types['openai'].env, 'OPENAI_API_KEY', 'OpenAI maps to OPENAI_API_KEY');
  assertEqual(types['github'].env, 'GITHUB_TOKEN', 'GitHub maps to GITHUB_TOKEN');
  assertEqual(types['google'].env, 'GOOGLE_API_KEY', 'Google maps to GOOGLE_API_KEY');
}

function testSecretValidation() {
  section('Secret Validation');

  const secrets = require(SECRETS_PATH);

  // Test valid formats
  const claudeValid = secrets.validateSecret('claude', 'sk-ant-test123');
  assertEqual(claudeValid.valid, true, 'Valid Claude key passes');

  const openaiValid = secrets.validateSecret('openai', 'sk-test123');
  assertEqual(openaiValid.valid, true, 'Valid OpenAI key passes');

  // Test invalid formats
  const claudeInvalid = secrets.validateSecret('claude', 'invalid-key');
  assertEqual(claudeInvalid.valid, false, 'Invalid Claude key fails');

  // Test empty value
  const emptySecret = secrets.validateSecret('claude', '');
  assertEqual(emptySecret.valid, false, 'Empty secret fails');

  // Test unknown type
  const unknownType = secrets.validateSecret('unknown', 'test');
  assertEqual(unknownType.valid, false, 'Unknown secret type fails');
}

function testKeychainProvider() {
  section('Keychain Provider');

  const secrets = require(SECRETS_PATH);

  const provider = secrets.getProvider();
  assertExists(provider, 'getProvider returns a provider');

  const expected = process.platform === 'win32' ? 'credential-manager' :
                   process.platform === 'darwin' ? 'keychain' : null;

  if (expected) {
    assertEqual(provider, expected, `Provider matches platform (${expected})`);
  } else {
    assert(provider === 'secret-tool' || provider === 'file', 'Linux provider is secret-tool or file');
  }

  // Test availability check
  const availability = secrets.checkKeychainAvailable();
  assertExists(availability, 'checkKeychainAvailable returns result');
  assert('available' in availability, 'Result has available property');
  assert('provider' in availability, 'Result has provider property');
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOWNLOADER EXTENSION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

function testDownloaderExtensions() {
  section('Downloader Extensions');

  const downloader = require(path.join(ROOT_DIR, 'components', 'downloader'));

  // Test new exports
  assertExists(downloader.downloadShell, 'downloadShell is exported');
  assertExists(downloader.downloadTerminal, 'downloadTerminal is exported');
  assertExists(downloader.getAvailableShellsForDownload, 'getAvailableShellsForDownload is exported');
  assertExists(downloader.getAvailableTerminalsForDownload, 'getAvailableTerminalsForDownload is exported');

  // Test function returns
  const shells = downloader.getAvailableShellsForDownload();
  assert(Array.isArray(shells), 'getAvailableShellsForDownload returns array');

  const terminals = downloader.getAvailableTerminalsForDownload();
  assert(Array.isArray(terminals), 'getAvailableTerminalsForDownload returns array');
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

function runTests() {
  console.log('='.repeat(70));
  console.log(`${colors.cyan}  ATOMCLI LAUNCHER & COMPONENTS TESTS${colors.reset}`);
  console.log('='.repeat(70));

  try {
    // Launcher tests
    testLauncherModule();
    testAppRegistry();
    testShellDetection();

    // Shell registry tests
    testShellRegistry();
    testShellEntries();
    testShellAvailability();

    // Terminal registry tests
    testTerminalRegistry();
    testTerminalEntries();
    testTerminalTypes();

    // Secrets manager tests
    testSecretsModule();
    testSecretTypes();
    testSecretValidation();
    testKeychainProvider();

    // Downloader extension tests
    testDownloaderExtensions();

  } catch (err) {
    console.log(`\n${colors.red}Test error: ${err.message}${colors.reset}`);
    console.log(err.stack);
    failed++;
  }

  // Summary
  console.log('\n' + '-'.repeat(70));
  console.log(`${colors.cyan}Summary:${colors.reset}`);
  console.log(`  ${colors.green}Passed:${colors.reset}  ${passed}`);
  console.log(`  ${colors.red}Failed:${colors.reset}  ${failed}`);
  console.log('-'.repeat(70));

  if (failed === 0) {
    console.log(`\n${colors.green}All tests passed!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}Some tests failed.${colors.reset}\n`);
    process.exit(1);
  }
}

runTests();
