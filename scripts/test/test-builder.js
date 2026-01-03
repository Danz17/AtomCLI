/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                        ATOMCLI - BUILDER TESTS                               ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Tests for the builder module                                                ║
 * ║                                                                              ║
 * ║  Usage:                                                                      ║
 * ║    node scripts/test/test-builder.js           # Run all tests              ║
 * ║    node scripts/test/test-builder.js --build   # Include integration tests  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

const path = require('path');
const fs = require('fs');

// Test configuration
const ROOT_DIR = path.resolve(__dirname, '../..');
const BUILDER_PATH = path.join(ROOT_DIR, 'components/builder');
const SOURCE_DIR = path.join(ROOT_DIR, 'core/claude-code/package');
const TEST_OUTPUT_DIR = path.join(ROOT_DIR, 'distro/test');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

// Test results
let passed = 0;
let failed = 0;
let skipped = 0;

/**
 * Test assertion helpers
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

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Integration Tests (require Bun and source files)
// ─────────────────────────────────────────────────────────────────────────────

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
    assert(content.includes('CLAUDE_CODE_BUNDLED'), 'Source has bundled marker');
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

// ─────────────────────────────────────────────────────────────────────────────
// Main Test Runner
// ─────────────────────────────────────────────────────────────────────────────

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
