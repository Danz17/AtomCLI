#!/usr/bin/env node
/**
 * Manual tarball extraction using Node.js zlib
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const tarballPath = 'D:/AI/Testing/AtomCLI/core/codex/codex.tgz';
const destDir = 'D:/AI/Testing/AtomCLI/core/codex';

console.log('Extracting:', tarballPath);
console.log('To:', destDir);

const gunzip = zlib.createGunzip();
const input = fs.createReadStream(tarballPath);
const chunks = [];

let totalBytes = 0;

gunzip.on('data', chunk => {
  chunks.push(chunk);
  totalBytes += chunk.length;
  process.stdout.write(`\rDecompressed: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
});

gunzip.on('end', () => {
  console.log('\nDecompression complete. Parsing tar archive...');

  try {
    const buffer = Buffer.concat(chunks);
    console.log(`Total decompressed size: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);

    let offset = 0;
    let fileCount = 0;
    let dirCount = 0;

    while (offset < buffer.length - 512) {
      const header = buffer.slice(offset, offset + 512);

      // Check for end of archive (two zero blocks)
      if (header.every(b => b === 0)) {
        console.log('Reached end of archive marker');
        break;
      }

      // Parse tar header
      const name = header.slice(0, 100).toString('utf8').replace(/\0/g, '').trim();
      const sizeOctal = header.slice(124, 136).toString('utf8').replace(/\0/g, '').trim();
      const typeFlag = header[156];
      const prefix = header.slice(345, 500).toString('utf8').replace(/\0/g, '').trim();

      const size = parseInt(sizeOctal, 8) || 0;
      const fullPath = prefix ? path.join(prefix, name) : name;
      const destPath = path.join(destDir, fullPath);

      offset += 512; // Move past header

      if (name && fullPath) {
        // Type 5 = directory, Type 0 or 48 (ASCII '0') = regular file
        if (typeFlag === 53 || name.endsWith('/')) {
          // Directory
          fs.mkdirSync(destPath, { recursive: true });
          dirCount++;
        } else if (typeFlag === 0 || typeFlag === 48) {
          // Regular file
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.writeFileSync(destPath, buffer.slice(offset, offset + size));
          fileCount++;

          if (fileCount % 100 === 0) {
            console.log(`Extracted ${fileCount} files...`);
          }
        }
      }

      // Move to next header (size rounded up to 512 byte blocks)
      offset += Math.ceil(size / 512) * 512;
    }

    console.log(`\n✓ Extraction complete!`);
    console.log(`  Directories: ${dirCount}`);
    console.log(`  Files: ${fileCount}`);

    // Verify key files exist
    const packageDir = path.join(destDir, 'package');
    if (fs.existsSync(packageDir)) {
      console.log(`  Package dir: ${packageDir}`);
      const files = fs.readdirSync(packageDir);
      console.log(`  Top-level files: ${files.slice(0, 10).join(', ')}${files.length > 10 ? '...' : ''}`);
    }

  } catch (err) {
    console.error('Extraction error:', err.message);
    process.exit(1);
  }
});

gunzip.on('error', err => {
  console.error('\nGzip error:', err.message);
  process.exit(1);
});

input.pipe(gunzip);
