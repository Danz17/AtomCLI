/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                    ATOMCLI - MULTI-CLI SUPPORT TESTS                         ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Tests for multi-CLI tool support                                            ║
 * ║                                                                              ║
 * ║  Validates:                                                                  ║
 * ║  - CLI_REGISTRY contains all supported tools with build configs             ║
 * ║  - generateBuildTargets() creates correct output names                       ║
 * ║  - BUILD_TARGET_TEMPLATES has all required fields                            ║
 * ║  - Dynamic target generation for each tool                                   ║
 * ║                                                                              ║
 * ║  Usage:                                                                      ║
 * ║    node scripts/test/test-multi-cli.cjs                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const ROOT_DIR = path.resolve(__dirname, '../..');
const BUILDER_PATH = path.join(ROOT_DIR, 'components', 'builder');
const DOWNLOADER_PATH = path.join(ROOT_DIR, 'components', 'downloader');

// Expected CLI tools
const EXPECTED_TOOLS = ['claude-code', 'codex', 'copilot', 'gemini'];

// Expected target platforms
const EXPECTED_TARGETS = [
  'windows-x64', 'windows-x64-modern', 'windows-x64-baseline',
  'linux-x64', 'linux-x64-modern', 'linux-x64-baseline', 'linux-arm64',
  'linux-x64-musl', 'linux-arm64-musl',
  'macos-x64', 'macos-arm64',
  'android-arm64',
];

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
    console.log(`  ${colors.green}✓${colors.reset} ${message}`);
    passed++;
  } else {
    console.log(`  ${colors.red}✗${colors.reset} ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  const match = actual === expected;
  if (match) {
    console.log(`  ${colors.green}✓${colors.reset} ${message}`);
    passed++;
  } else {
    console.log(`  ${colors.red}✗${colors.reset} ${message}`);
    console.log(`    ${colors.dim}Expected: ${expected}${colors.reset}`);
    console.log(`    ${colors.dim}Actual:   ${actual}${colors.reset}`);
    failed++;
  }
}

function assertExists(value, message) {
  assert(value !== undefined && value !== null, message);
}

function section(title) {
  console.log(`\n${colors.cyan}▶ ${title}${colors.reset}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS
// ═══════════════════════════════════════════════════════════════════════════════

function testCLIRegistry() {
  section('CLI Registry');

  const downloader = require(DOWNLOADER_PATH);
  const registry = downloader.CLI_REGISTRY;

  assertExists(registry, 'CLI_REGISTRY is exported');

  // Test all expected tools exist
  for (const toolId of EXPECTED_TOOLS) {
    assertExists(registry[toolId], `Tool '${toolId}' exists in registry`);
  }

  // Test tool structure
  for (const toolId of EXPECTED_TOOLS) {
    const tool = registry[toolId];
    if (!tool) continue;

    assertExists(tool.name, `${toolId} has name`);
    assertExists(tool.npm, `${toolId} has npm package`);
    assertExists(tool.build, `${toolId} has build config`);

    if (tool.build) {
      assertExists(tool.build.entryPoint, `${toolId} has entryPoint`);
      assertExists(tool.build.envPrefix, `${toolId} has envPrefix`);
      assertExists(tool.build.binaryName, `${toolId} has binaryName`);
    }
  }
}

function testBuildTargetTemplates() {
  section('Build Target Templates');

  const builder = require(BUILDER_PATH);
  const templates = builder.BUILD_TARGET_TEMPLATES;

  assertExists(templates, 'BUILD_TARGET_TEMPLATES is exported');

  // Test all expected targets exist
  for (const targetId of EXPECTED_TARGETS) {
    assertExists(templates[targetId], `Template '${targetId}' exists`);
  }

  // Test template structure
  const firstTarget = templates['windows-x64'];
  if (firstTarget) {
    assertExists(firstTarget.target, 'Template has target (Bun flag)');
    assertExists(firstTarget.platform, 'Template has platform');
    assertExists(firstTarget.arch, 'Template has arch');
    assert(firstTarget.extension !== undefined, 'Template has extension field');
  }
}

function testGenerateBuildTargets() {
  section('generateBuildTargets()');

  const builder = require(BUILDER_PATH);

  assertExists(builder.generateBuildTargets, 'generateBuildTargets is exported');

  // Test target generation for each tool
  const tools = [
    { id: 'claude-code', binary: 'claude-code' },
    { id: 'codex', binary: 'codex' },
    { id: 'copilot', binary: 'copilot' },
    { id: 'gemini', binary: 'gemini' },
  ];

  for (const tool of tools) {
    const targets = builder.generateBuildTargets(tool.id, {
      build: { binaryName: tool.binary }
    });

    assertExists(targets, `Targets generated for ${tool.id}`);

    // Check Windows target
    if (targets['windows-x64']) {
      assertEqual(
        targets['windows-x64'].output,
        `${tool.binary}-windows-x64.exe`,
        `${tool.id} Windows output name is correct`
      );
    }

    // Check Linux target
    if (targets['linux-x64']) {
      assertEqual(
        targets['linux-x64'].output,
        `${tool.binary}-linux-x64`,
        `${tool.id} Linux output name is correct`
      );
    }

    // Check macOS target
    if (targets['macos-arm64']) {
      assertEqual(
        targets['macos-arm64'].output,
        `${tool.binary}-macos-arm64`,
        `${tool.id} macOS ARM64 output name is correct`
      );
    }
  }
}

function testDefaultBuildTargets() {
  section('Default BUILD_TARGETS (Backwards Compatibility)');

  const builder = require(BUILDER_PATH);
  const targets = builder.BUILD_TARGETS;

  assertExists(targets, 'BUILD_TARGETS is exported');

  // Should be Claude Code by default
  if (targets['windows-x64']) {
    assertEqual(
      targets['windows-x64'].output,
      'claude-code-windows-x64.exe',
      'Default targets use claude-code binary name'
    );
  }

  // Check all expected targets exist
  let targetCount = 0;
  for (const targetId of EXPECTED_TARGETS) {
    if (targets[targetId]) targetCount++;
  }
  assert(targetCount === EXPECTED_TARGETS.length, `All ${EXPECTED_TARGETS.length} targets present`);
}

function testBuildFunctionsExported() {
  section('Builder Module Exports');

  const builder = require(BUILDER_PATH);

  // Core functions
  assertExists(builder.buildTarget, 'buildTarget is exported');
  assertExists(builder.buildTargets, 'buildTargets is exported');
  assertExists(builder.buildPlatform, 'buildPlatform is exported');
  assertExists(builder.prepareSource, 'prepareSource is exported');

  // Utilities
  assertExists(builder.hasBun, 'hasBun is exported');
  assertExists(builder.getBunVersion, 'getBunVersion is exported');
  assertExists(builder.findBunPath, 'findBunPath is exported');
  assertExists(builder.getCurrentTarget, 'getCurrentTarget is exported');
  assertExists(builder.getTargetsForPlatform, 'getTargetsForPlatform is exported');

  // Multi-CLI support
  assertExists(builder.generateBuildTargets, 'generateBuildTargets is exported');
  assertExists(builder.BUILD_TARGET_TEMPLATES, 'BUILD_TARGET_TEMPLATES is exported');
}

function testDownloaderExports() {
  section('Downloader Module Exports');

  const downloader = require(DOWNLOADER_PATH);

  assertExists(downloader.CLI_REGISTRY, 'CLI_REGISTRY is exported');
  assertExists(downloader.downloadTool, 'downloadTool is exported');
  assertExists(downloader.getAvailableTools, 'getAvailableTools is exported');
}

function testOutputNamingConvention() {
  section('Output Naming Convention');

  const builder = require(BUILDER_PATH);

  // Generate targets for different tools and verify naming
  const testCases = [
    { id: 'claude-code', expected: { win: 'claude-code-windows-x64.exe', linux: 'claude-code-linux-x64' } },
    { id: 'codex', expected: { win: 'codex-windows-x64.exe', linux: 'codex-linux-x64' } },
    { id: 'copilot', expected: { win: 'copilot-windows-x64.exe', linux: 'copilot-linux-x64' } },
    { id: 'gemini', expected: { win: 'gemini-windows-x64.exe', linux: 'gemini-linux-x64' } },
  ];

  for (const { id, expected } of testCases) {
    const targets = builder.generateBuildTargets(id, { build: { binaryName: id } });

    assertEqual(targets['windows-x64'].output, expected.win, `${id} Windows naming: ${expected.win}`);
    assertEqual(targets['linux-x64'].output, expected.linux, `${id} Linux naming: ${expected.linux}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

function runTests() {
  console.log('═'.repeat(70));
  console.log(`${colors.cyan}  ATOMCLI MULTI-CLI SUPPORT TESTS${colors.reset}`);
  console.log('═'.repeat(70));

  try {
    // Unit tests
    testCLIRegistry();
    testBuildTargetTemplates();
    testGenerateBuildTargets();
    testDefaultBuildTargets();
    testBuildFunctionsExported();
    testDownloaderExports();
    testOutputNamingConvention();

  } catch (err) {
    console.log(`\n${colors.red}Test error: ${err.message}${colors.reset}`);
    console.log(err.stack);
    failed++;
  }

  // Summary
  console.log('\n' + '─'.repeat(70));
  console.log(`${colors.cyan}Summary:${colors.reset}`);
  console.log(`  ${colors.green}Passed:${colors.reset}  ${passed}`);
  console.log(`  ${colors.red}Failed:${colors.reset}  ${failed}`);
  console.log('─'.repeat(70));

  if (failed === 0) {
    console.log(`\n${colors.green}All tests passed!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}Some tests failed.${colors.reset}\n`);
    process.exit(1);
  }
}

runTests();
