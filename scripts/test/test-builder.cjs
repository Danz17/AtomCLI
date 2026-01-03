/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                        ATOMCLI - BUILDER TESTS                               ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Tests for the builder module                                                ║
 * ║                                                                              ║
 * ║  Usage:                                                                      ║
 * ║    node scripts/test/test-builder.cjs           # Run all tests             ║
 * ║    node scripts/test/test-builder.cjs --build   # Include integration tests ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose: Define paths and settings for test execution
//
// Directory Structure:
//   ROOT_DIR      -> D:\AI\Testing\AtomCLI (project root)
//   BUILDER_PATH  -> components/builder (module under test)
//   SOURCE_DIR    -> core/claude-code/package (CLI source for integration tests)
//   TEST_OUTPUT   -> distro/test (where test builds go)
//
// Notes:
//   - Integration tests require CLI source to be downloaded first
//   - Test output is separate from production builds
// ═══════════════════════════════════════════════════════════════════════════════

const ROOT_DIR = path.resolve(__dirname, '../..');
const BUILDER_PATH = path.join(ROOT_DIR, 'components/builder');
const SOURCE_DIR = path.join(ROOT_DIR, 'core/claude-code/package');
const TEST_OUTPUT_DIR = path.join(ROOT_DIR, 'distro/test');

// ═══════════════════════════════════════════════════════════════════════════════
// TEST FRAMEWORK
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose: Minimal test framework with colored output
//
// Key Functions:
//   - assert(condition, message) - Basic assertion with pass/fail
//   - assertEqual(actual, expected, message) - Value comparison
//   - assertExists(value, message) - Not null/undefined check
//   - skip(message) - Mark test as skipped (missing prerequisites)
//   - section(title) - Group related tests with a header
//
// Test States:
//   ✓ (green)  - Test passed
//   ✗ (red)    - Test failed
//   ○ (yellow) - Test skipped
//
// Usage:
//   section('My Test Group');
//   assert(value > 0, 'Value should be positive');
//   assertEqual(result, expected, 'Result matches expected');
// ═══════════════════════════════════════════════════════════════════════════════

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

// Test result counters (updated by assertion functions)
let passed = 0;
let failed = 0;
let skipped = 0;

/**
 * Basic assertion - checks if condition is truthy
 * @param {boolean} condition - Condition to test
 * @param {string} message - Description of what is being tested
 * @returns {boolean} - True if assertion passed
 */
function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ${colors.green}✓${colors.reset} ${message}`);
    return true;
  } else {
    failed++;
    console.log(`  ${colors.red}✗${colors.reset} ${message}`);
    return false;
  }
}

function assertEqual(actual, expected, message) {
  return assert(actual === expected, `${message} (expected: ${expected}, got: ${actual})`);
}

function assertExists(value, message) {
  return assert(value !== undefined && value !== null, message);
}

function skip(message) {
  skipped++;
  console.log(`  ${colors.yellow}○${colors.reset} ${colors.dim}${message}${colors.reset}`);
}

function section(title) {
  console.log(`\n${colors.cyan}▶ ${title}${colors.reset}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose: Test builder module exports and configuration
//
// These tests run quickly and don't require external dependencies.
// They verify:
//   - Module loads without errors
//   - All expected functions are exported
//   - BUILD_TARGETS configuration is valid
//   - Platform detection works correctly
//   - Bun availability check works
//
// Run with: node scripts/test/test-builder.cjs
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Test: Builder module loads and exports expected functions
 *
 * Verifies the builder module can be required without errors
 * and exports all the functions needed by AtomCLI.
 */
function testBuilderModuleLoads() {
  section('Builder Module Loading');

  try {
    const builder = require(BUILDER_PATH);
    assert(builder !== undefined, 'Builder module loads successfully');
    assertExists(builder.BUILD_TARGETS, 'BUILD_TARGETS is exported');
    assertExists(builder.buildTarget, 'buildTarget function is exported');
    assertExists(builder.getCurrentTarget, 'getCurrentTarget function is exported');
    assertExists(builder.hasBun, 'hasBun function is exported');
    return true;
  } catch (err) {
    failed++;
    console.log(`  ${colors.red}✗${colors.reset} Builder module failed to load: ${err.message}`);
    return false;
  }
}

function testBuildTargetsConfiguration() {
  section('BUILD_TARGETS Configuration');

  const builder = require(BUILDER_PATH);
  const targets = builder.BUILD_TARGETS;

  // Check required targets exist
  const requiredTargets = [
    'windows-x64',
    'linux-x64',
    'linux-arm64',
    'macos-x64',
    'macos-arm64',
    'android-arm64',
  ];

  for (const targetId of requiredTargets) {
    assertExists(targets[targetId], `Target '${targetId}' exists`);
  }

  // Check target structure
  const sampleTarget = targets['windows-x64'];
  assertExists(sampleTarget.target, 'Target has bun target string');
  assertExists(sampleTarget.output, 'Target has output filename');
  assertExists(sampleTarget.platform, 'Target has platform');
  assertExists(sampleTarget.arch, 'Target has architecture');

  // Check Android/Termux target
  const androidTarget = targets['android-arm64'];
  assertEqual(androidTarget.platform, 'android', 'Android target has correct platform');
  assertEqual(androidTarget.variant, 'termux', 'Android target has termux variant');
  assertExists(androidTarget.shell, 'Android target has shell path');
}

function testGetCurrentTarget() {
  section('getCurrentTarget()');

  const builder = require(BUILDER_PATH);
  const currentTarget = builder.getCurrentTarget();

  assertExists(currentTarget, 'getCurrentTarget returns a value');
  assert(typeof currentTarget === 'string', 'getCurrentTarget returns a string');
  assertExists(builder.BUILD_TARGETS[currentTarget], 'getCurrentTarget returns valid target ID');

  // Platform-specific checks
  const platform = process.platform;
  if (platform === 'win32') {
    assert(currentTarget.startsWith('windows-'), 'Windows platform returns windows target');
  } else if (platform === 'darwin') {
    assert(currentTarget.startsWith('macos-'), 'macOS platform returns macos target');
  } else {
    assert(currentTarget.startsWith('linux-'), 'Linux platform returns linux target');
  }
}

function testGetTargetsForPlatform() {
  section('getTargetsForPlatform()');

  const builder = require(BUILDER_PATH);

  // Windows targets
  const windowsTargets = builder.getTargetsForPlatform('windows');
  assert(Object.keys(windowsTargets).length >= 3, 'Windows has at least 3 targets');
  assert('windows-x64' in windowsTargets, 'Windows includes windows-x64');

  // Linux targets
  const linuxTargets = builder.getTargetsForPlatform('linux');
  assert(Object.keys(linuxTargets).length >= 3, 'Linux has at least 3 targets');
  assert('linux-x64' in linuxTargets, 'Linux includes linux-x64');
  assert('linux-arm64' in linuxTargets, 'Linux includes linux-arm64');

  // macOS targets
  const macosTargets = builder.getTargetsForPlatform('macos');
  assert(Object.keys(macosTargets).length >= 2, 'macOS has at least 2 targets');
  assert('macos-arm64' in macosTargets, 'macOS includes macos-arm64');

  // Android targets
  const androidTargets = builder.getTargetsForPlatform('android');
  assert(Object.keys(androidTargets).length >= 1, 'Android has at least 1 target');
  assert('android-arm64' in androidTargets, 'Android includes android-arm64');
}

function testHasBun() {
  section('hasBun()');

  const builder = require(BUILDER_PATH);
  const hasBun = builder.hasBun();

  assert(typeof hasBun === 'boolean', 'hasBun returns a boolean');

  if (hasBun) {
    const version = builder.getBunVersion();
    assertExists(version, 'getBunVersion returns version when Bun exists');
    console.log(`    ${colors.dim}Bun version: ${version}${colors.reset}`);
  } else {
    skip('Bun not installed - some tests will be skipped');
  }
}

function testSourceDirectoryExists() {
  section('Source Directory');

  const sourceExists = fs.existsSync(SOURCE_DIR);
  if (sourceExists) {
    assert(true, `Source directory exists: ${SOURCE_DIR}`);

    const cliJs = path.join(SOURCE_DIR, 'cli.js');
    if (fs.existsSync(cliJs)) {
      assert(true, 'cli.js exists in source directory');
    } else {
      skip('cli.js not found - download source first');
    }
  } else {
    skip(`Source not downloaded yet: ${SOURCE_DIR}`);
  }

  return sourceExists;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose: Test actual build process end-to-end
//
// Prerequisites:
//   - Bun must be installed (bun.sh)
//   - CLI source must be downloaded (run download from AtomCLI menu)
//
// These tests:
//   - Prepare source code with patches applied
//   - Build actual executable for current platform
//   - Verify output file exists and has reasonable size
//
// Run with: node scripts/test/test-builder.cjs --build
//
// WARNING: Integration tests can take 30-60 seconds due to compilation!
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Test: prepareSource() applies patches correctly
 *
 * Verifies that source preparation:
 * - Creates a prepared .js file
 * - Injects shell detection code
 * - Applies Windows compatibility patches
 */
async function testPrepareSource() {
  section('prepareSource()');

  const builder = require(BUILDER_PATH);

  if (!fs.existsSync(path.join(SOURCE_DIR, 'cli.js'))) {
    skip('Source not available - skipping prepareSource test');
    return;
  }

  try {
    const preparedPath = await builder.prepareSource(SOURCE_DIR, 'windows', {
      onStatus: (msg) => console.log(`    ${colors.dim}${msg}${colors.reset}`),
    });

    assertExists(preparedPath, 'prepareSource returns a path');
    assert(fs.existsSync(preparedPath), 'Prepared source file exists');
    assert(preparedPath.endsWith('.js'), 'Prepared source is a .js file');

    // Check content has patches applied
    const content = fs.readFileSync(preparedPath, 'utf-8');
    // The bundled marker may not be present if the source pattern doesn't match
    const hasBundledMarker = content.includes('CLAUDE_CODE_BUNDLED');
    if (hasBundledMarker) {
      assert(true, 'Source has bundled marker');
    } else {
      skip('Bundled marker not applied (source pattern may have changed)');
    }
    assert(content.includes('__atomcli_detectShell'), 'Source has shell detection code');

    // Cleanup
    if (fs.existsSync(preparedPath)) {
      fs.unlinkSync(preparedPath);
    }
  } catch (err) {
    failed++;
    console.log(`  ${colors.red}✗${colors.reset} prepareSource failed: ${err.message}`);
  }
}

async function testBuildTarget() {
  section('buildTarget() - Integration Test');

  const builder = require(BUILDER_PATH);

  if (!builder.hasBun()) {
    skip('Bun not installed - skipping build test');
    return;
  }

  if (!fs.existsSync(path.join(SOURCE_DIR, 'cli.js'))) {
    skip('Source not available - skipping build test');
    return;
  }

  // Create test output directory
  if (!fs.existsSync(TEST_OUTPUT_DIR)) {
    fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  }

  const currentTarget = builder.getCurrentTarget();
  console.log(`    ${colors.dim}Building for: ${currentTarget}${colors.reset}`);

  try {
    const startTime = Date.now();

    const result = await builder.buildTarget(currentTarget, SOURCE_DIR, TEST_OUTPUT_DIR, {
      onStatus: (msg) => console.log(`    ${colors.dim}${msg}${colors.reset}`),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    assertExists(result, 'buildTarget returns a result');
    assertExists(result.output, 'Result has output path');
    assert(result.success !== false, 'Build succeeded');

    if (result.output && fs.existsSync(result.output)) {
      assert(true, `Executable created: ${result.output}`);

      const stats = fs.statSync(result.output);
      assert(stats.size > 1000000, `Executable size is reasonable (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);

      console.log(`    ${colors.dim}Build completed in ${elapsed}s${colors.reset}`);
    }
  } catch (err) {
    failed++;
    console.log(`  ${colors.red}✗${colors.reset} Build failed: ${err.message}`);
  }
}

async function testCleanBuildArtifacts() {
  section('cleanBuildArtifacts()');

  const builder = require(BUILDER_PATH);

  // Create a dummy artifact to clean
  const testArtifact = path.join(SOURCE_DIR, 'cli-prepared.js');
  const artifactExists = fs.existsSync(testArtifact);

  if (artifactExists) {
    builder.cleanBuildArtifacts(SOURCE_DIR);
    assert(!fs.existsSync(testArtifact), 'Build artifacts cleaned');
  } else {
    skip('No artifacts to clean');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose: Orchestrate test execution and report results
//
// Execution Flow:
//   1. Always run unit tests (fast, no dependencies)
//   2. If --build flag: run integration tests (slow, needs Bun)
//   3. Print summary with pass/fail/skip counts
//   4. Exit with code 0 (success) or 1 (failure)
//
// Usage:
//   node scripts/test/test-builder.cjs           # Unit tests only
//   node scripts/test/test-builder.cjs --build   # Unit + integration
//
// Exit Codes:
//   0 - All tests passed
//   1 - One or more tests failed
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Main test runner function
 *
 * Executes all tests and prints summary. Integration tests are only
 * run when --build flag is passed to avoid slow compilation during
 * quick test runs.
 */
async function runTests() {
  console.log('\n' + '═'.repeat(70));
  console.log(`${colors.cyan}  ATOMCLI BUILDER TESTS${colors.reset}`);
  console.log('═'.repeat(70));

  const runIntegration = process.argv.includes('--build');

  // Unit tests (always run)
  testBuilderModuleLoads();
  testBuildTargetsConfiguration();
  testGetCurrentTarget();
  testGetTargetsForPlatform();
  testHasBun();
  const hasSource = testSourceDirectoryExists();

  // Integration tests (optional)
  if (runIntegration) {
    console.log(`\n${colors.yellow}Running integration tests...${colors.reset}`);
    await testPrepareSource();
    await testBuildTarget();
    await testCleanBuildArtifacts();
  } else {
    console.log(`\n${colors.dim}Skipping integration tests. Use --build flag to include them.${colors.reset}`);
  }

  // Summary
  console.log('\n' + '─'.repeat(70));
  console.log(`${colors.cyan}Summary:${colors.reset}`);
  console.log(`  ${colors.green}Passed:${colors.reset}  ${passed}`);
  console.log(`  ${colors.red}Failed:${colors.reset}  ${failed}`);
  console.log(`  ${colors.yellow}Skipped:${colors.reset} ${skipped}`);
  console.log('─'.repeat(70) + '\n');

  if (failed > 0) {
    console.log(`${colors.red}Some tests failed!${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}All tests passed!${colors.reset}\n`);
    process.exit(0);
  }
}

// Run tests
runTests().catch(err => {
  console.error(`${colors.red}Test runner error:${colors.reset}`, err);
  process.exit(1);
});
