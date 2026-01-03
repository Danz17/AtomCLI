#!/usr/bin/env node
/**
 * Build OpenAI Codex executable
 * Downloads from npm and compiles to standalone binary
 */

'use strict';

const path = require('path');
const fs = require('fs');

// Project root
const ROOT_DIR = path.resolve(__dirname, '..');

// Add components to require path
const downloader = require(path.join(ROOT_DIR, 'components', 'downloader'));
const builder = require(path.join(ROOT_DIR, 'components', 'builder'));

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║            ATOMCLI - BUILD OPENAI CODEX                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const toolId = 'codex';
  const toolConfig = downloader.CLI_REGISTRY[toolId];

  if (!toolConfig) {
    console.error('Error: Codex not found in CLI_REGISTRY');
    process.exit(1);
  }

  console.log(`Tool: ${toolConfig.name}`);
  console.log(`Package: ${toolConfig.npm}`);
  console.log(`Entry Point: ${toolConfig.build.entryPoint}`);
  console.log('');

  // Step 1: Download from npm
  console.log('── Step 1: Download from npm ─────────────────────────────────');
  const destDir = path.join(ROOT_DIR, 'core', toolId);

  try {
    const downloadResult = await downloader.downloadTool(toolId, destDir, {
      onStatus: (msg) => console.log(`  ${msg}`),
      onProgress: (received, total, percent) => {
        process.stdout.write(`\r  Downloading: ${percent}% (${(received/1024/1024).toFixed(1)}MB / ${(total/1024/1024).toFixed(1)}MB)`);
      },
    });

    console.log('');
    if (downloadResult.skipped) {
      console.log(`  ✓ Already up-to-date: ${downloadResult.version}`);
    } else {
      console.log(`  ✓ Downloaded: ${downloadResult.version}`);
    }
    console.log(`  Location: ${downloadResult.extractDir}`);
  } catch (err) {
    console.error(`\n  ✗ Download failed: ${err.message}`);
    process.exit(1);
  }

  // Step 2: Build executable
  console.log('\n── Step 2: Build Windows Executable ──────────────────────────');

  // Check Bun availability
  if (!builder.hasBun()) {
    console.error('  ✗ Bun not found. Install from https://bun.sh');
    process.exit(1);
  }
  console.log(`  Bun version: ${builder.getBunVersion()}`);

  const sourceDir = path.join(destDir, 'package');
  const outputDir = path.join(ROOT_DIR, 'distro');
  const targetId = 'windows-x64';

  try {
    const buildResult = await builder.buildTarget(targetId, sourceDir, outputDir, {
      onStatus: (msg) => console.log(`  ${msg}`),
      onProgress: (msg) => process.stdout.write(msg),
      toolId,
      toolConfig,
    });

    console.log('');
    console.log(`  ✓ Build successful!`);
    console.log(`  Output: ${buildResult.output}`);
    console.log(`  Size: ${buildResult.sizeMB} MB`);
    console.log(`  Time: ${buildResult.elapsed}`);
  } catch (err) {
    console.error(`\n  ✗ Build failed: ${err.message}`);
    process.exit(1);
  }

  // Step 3: Verify
  console.log('\n── Step 3: Verify Build ──────────────────────────────────────');
  const exePath = path.join(outputDir, 'windows', `codex-${targetId}.exe`);

  if (fs.existsSync(exePath)) {
    const stats = fs.statSync(exePath);
    console.log(`  ✓ Executable exists: ${exePath}`);
    console.log(`  Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log('\n✓ Codex build complete!');
  } else {
    console.error(`  ✗ Executable not found at: ${exePath}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
