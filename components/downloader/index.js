/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                        ATOMCLI - DOWNLOADER MODULE                           ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Downloads and extracts CLI tools from various sources                       ║
 * ║                                                                              ║
 * ║  Supported Sources:                                                          ║
 * ║  - npm registry (@anthropic-ai/claude-code, etc.)                            ║
 * ║  - GitHub releases                                                           ║
 * ║  - Direct URLs                                                               ║
 * ║                                                                              ║
 * ║  Features:                                                                   ║
 * ║  - Progress tracking                                                         ║
 * ║  - Checksum verification                                                     ║
 * ║  - Automatic extraction (tar.gz, zip)                                        ║
 * ║  - Resume interrupted downloads                                              ║
 * ║  - Smart caching (skip if local matches remote)                              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Filename for the download cache manifest
 * This file tracks version/checksum to enable smart caching
 */
const MANIFEST_FILENAME = '.atomcli-manifest.json';

// ═══════════════════════════════════════════════════════════════════════════════
// CLI TOOL REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose: Define supported CLI tools and their sources
//
// To add a new CLI tool:
//   1. Add entry with npm package name and/or GitHub repo
//   2. List required files that must be downloaded
//   3. List vendor dependencies (ripgrep, etc.)
//   4. Set placeholder: true if not yet implemented
//
// Example:
//   'my-tool': {
//     name: 'My Tool',
//     description: 'Description here',
//     npm: '@org/my-tool',
//     github: 'org/my-tool',
//     files: ['cli.js', 'package.json'],
//     vendor: [],
//   }
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Registry of supported CLI tools
 *
 * Each tool defines its npm package, GitHub repo, required files,
 * and vendor dependencies. This allows AtomCLI to download and
 * build any registered CLI tool.
 *
 * @type {Object.<string, {name: string, npm: string, github: string, files: string[], vendor: string[]}>}
 */
const CLI_REGISTRY = {
  // ─────────────────────────────────────────────────────────────────────────────
  // CLAUDE CODE - Anthropic's AI coding assistant
  // ─────────────────────────────────────────────────────────────────────────────
  'claude-code': {
    name: 'Claude Code',
    description: 'AI coding assistant by Anthropic',
    npm: '@anthropic-ai/claude-code',
    github: 'anthropics/claude-code',
    // Build configuration for single-binary compilation
    build: {
      entryPoint: 'cli.js',           // Main entry point file
      envPrefix: 'CLAUDE_CODE',       // Environment variable prefix
      binaryName: 'claude-code',      // Output binary name (without extension)
    },
    files: ['cli.js', 'sdk.mjs', 'sdk.d.ts', 'yoga.wasm', 'package.json'],
    vendor: ['ripgrep', 'claude-code.vsix'],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // OPENAI CODEX - OpenAI's AI coding assistant
  // ─────────────────────────────────────────────────────────────────────────────
  'codex': {
    name: 'OpenAI Codex',
    description: 'AI coding assistant by OpenAI',
    npm: '@openai/codex',
    github: 'openai/codex',
    build: {
      entryPoint: 'bin/codex.js',     // Codex uses bin/ directory
      envPrefix: 'CODEX',
      binaryName: 'codex',
    },
    files: [],  // Auto-discovered from package
    vendor: [],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GITHUB COPILOT CLI - GitHub's AI coding assistant
  // ─────────────────────────────────────────────────────────────────────────────
  'copilot': {
    name: 'GitHub Copilot CLI',
    description: 'AI coding assistant by GitHub',
    npm: '@githubnext/github-copilot-cli',
    github: 'github/copilot-cli',
    build: {
      entryPoint: 'dist/index.js',  // Bundled entry
      envPrefix: 'COPILOT',
      binaryName: 'copilot',
    },
    files: [],
    vendor: [],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GOOGLE GEMINI CLI - Google's AI coding assistant
  // ─────────────────────────────────────────────────────────────────────────────
  'gemini': {
    name: 'Google Gemini CLI',
    description: 'AI coding assistant by Google',
    npm: '@google/gemini-cli',
    github: 'google-gemini/gemini-cli',
    build: {
      entryPoint: 'dist/index.js',  // Compiled TypeScript entry
      envPrefix: 'GEMINI',
      binaryName: 'gemini',
    },
    files: [],
    vendor: [],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SOURCEGRAPH CODY CLI - Sourcegraph's AI coding assistant
  // ─────────────────────────────────────────────────────────────────────────────
  'cody': {
    name: 'Sourcegraph Cody CLI',
    description: 'AI coding assistant by Sourcegraph',
    npm: '@sourcegraph/cody-cli',
    github: 'sourcegraph/cody',
    build: {
      entryPoint: 'cli.js',
      envPrefix: 'CODY',
      binaryName: 'cody',
    },
    files: [],
    vendor: [],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // ATOMCLI LAUNCHER - Universal AI CLI launcher
  // ─────────────────────────────────────────────────────────────────────────────
  'launcher': {
    name: 'AtomCLI Launcher',
    description: 'Universal launcher for AI coding assistants',
    npm: null,  // Local build only, not from npm
    github: null,
    build: {
      entryPoint: 'launcher-cli.js',
      envPrefix: 'LAUNCHER',
      binaryName: 'launcher',
    },
    files: ['launcher-cli.js', 'index.js'],
    vendor: [],
    local: true,  // Flag indicating this is a local-only build
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// DOWNLOAD UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose: Core HTTP download functionality with progress tracking
//
// Key Functions:
//   - downloadFile(url, destPath, onProgress) - Download with progress callback
//   - fetchJson(url) - Fetch and parse JSON from URL
//   - extractTarball(tarPath, destDir) - Extract .tgz files using tar
//
// Progress Callback:
//   onProgress(receivedBytes, totalBytes, percentComplete)
//
// Features:
//   - Automatic redirect following (301, 302, etc.)
//   - Streaming to disk (memory efficient for large files)
//   - Progress percentage calculation
//   - Cross-platform tar extraction
//
// Notes:
//   - Uses native https/http modules (no dependencies)
//   - Tar extraction requires 'tar' command in PATH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Download a file with progress tracking
 *
 * Streams the file directly to disk to avoid memory issues with large files.
 * Supports automatic redirect following for CDN URLs.
 * @param {string} url - URL to download
 * @param {string} destPath - Destination file path
 * @param {Function} [onProgress] - Progress callback (received, total, percent)
 * @returns {Promise<string>} - Path to downloaded file
 */
async function downloadFile(url, destPath, onProgress = null) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location, destPath, onProgress)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10) || 0;
      let downloadedSize = 0;

      // Ensure directory exists
      const dir = path.dirname(destPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const fileStream = fs.createWriteStream(destPath);

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (onProgress && totalSize > 0) {
          const percent = Math.round((downloadedSize / totalSize) * 100);
          onProgress(downloadedSize, totalSize, percent);
        }
      });

      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(destPath);
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {}); // Delete partial file
        reject(err);
      });
    });

    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

/**
 * Fetch JSON from URL
 * @param {string} url
 * @returns {Promise<Object>}
 */
async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, { headers: { 'User-Agent': 'AtomCLI/1.0' } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return fetchJson(response.headers.location).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    }).on('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// NPM Fetcher
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get package info from npm registry
 * @param {string} packageName - npm package name
 * @returns {Promise<Object>}
 */
async function getNpmPackageInfo(packageName) {
  const encodedName = encodeURIComponent(packageName).replace('%40', '@');
  const url = `https://registry.npmjs.org/${encodedName}`;

  const data = await fetchJson(url);

  return {
    name: data.name,
    description: data.description,
    latestVersion: data['dist-tags']?.latest,
    versions: Object.keys(data.versions || {}),
    tarball: data.versions?.[data['dist-tags']?.latest]?.dist?.tarball,
    homepage: data.homepage,
    repository: data.repository?.url,
  };
}

/**
 * Download package from npm
 * @param {string} packageName - npm package name
 * @param {string} destDir - Destination directory
 * @param {Object} [options]
 * @param {string} [options.version] - Specific version (default: latest)
 * @param {Function} [options.onProgress] - Progress callback
 * @param {Function} [options.onStatus] - Status callback
 * @param {boolean} [options.force=false] - Force download even if up-to-date
 * @returns {Promise<Object>} - Downloaded package info
 */
async function downloadFromNpm(packageName, destDir, options = {}) {
  const { version, onProgress, onStatus, force = false } = options;

  onStatus?.('Checking for updates...');

  // Get detailed package info including shasum
  const pkgVersionInfo = await getNpmPackageVersionInfo(packageName, version);
  const targetVersion = pkgVersionInfo.version;
  const remoteShasum = pkgVersionInfo.shasum;
  const tarballUrl = pkgVersionInfo.tarball;

  if (!tarballUrl) {
    throw new Error(`No tarball found for ${packageName}@${targetVersion}`);
  }

  // Check if we already have this version (skip if up-to-date)
  if (!force) {
    const cacheCheck = checkIfUpToDate(destDir, packageName, targetVersion, remoteShasum);

    if (cacheCheck.upToDate) {
      onStatus?.(`Already up-to-date: ${packageName}@${targetVersion}`);
      const extractDir = path.join(destDir, 'package');
      return {
        name: packageName,
        version: targetVersion,
        tarballPath: null,
        extractDir,
        files: fs.existsSync(extractDir) ? fs.readdirSync(extractDir) : [],
        skipped: true,
        reason: cacheCheck.reason,
      };
    }

    onStatus?.(`Update needed: ${cacheCheck.reason}`);
  }

  onStatus?.(`Downloading ${packageName}@${targetVersion}...`);

  // Download tarball
  const tarballPath = path.join(destDir, `${packageName.replace('/', '-')}-${targetVersion}.tgz`);
  await downloadFile(tarballUrl, tarballPath, onProgress);

  // Verify downloaded file checksum (using sha1 which npm provides)
  if (remoteShasum) {
    onStatus?.('Verifying checksum...');
    const isValid = await verifyChecksum(tarballPath, remoteShasum, 'sha1');
    if (!isValid) {
      fs.unlinkSync(tarballPath);
      throw new Error(`Checksum verification failed for ${packageName}@${targetVersion}`);
    }
  }

  onStatus?.('Extracting package...');

  // Clean up old extracted files
  const extractDir = path.join(destDir, 'package');
  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }

  // Extract tarball
  await extractTarball(tarballPath, destDir);

  // Save manifest for future cache checks
  writeManifest(destDir, {
    packageName,
    version: targetVersion,
    shasum: remoteShasum,
    tarball: tarballUrl,
    downloadedAt: new Date().toISOString(),
    extractDir,
  });

  // Clean up tarball to save space (keep manifest for cache)
  try {
    fs.unlinkSync(tarballPath);
  } catch (err) {
    // Non-fatal
  }

  return {
    name: packageName,
    version: targetVersion,
    tarballPath: null, // Deleted after extraction
    extractDir,
    files: fs.readdirSync(extractDir),
    skipped: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GitHub Fetcher
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get latest release from GitHub
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Object>}
 */
async function getGitHubRelease(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

  const data = await fetchJson(url);

  return {
    tagName: data.tag_name,
    name: data.name,
    body: data.body,
    publishedAt: data.published_at,
    assets: data.assets?.map(a => ({
      name: a.name,
      size: a.size,
      downloadUrl: a.browser_download_url,
      contentType: a.content_type,
    })) || [],
  };
}

/**
 * Download release asset from GitHub
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} assetName - Asset filename
 * @param {string} destPath - Destination path
 * @param {Function} [onProgress] - Progress callback
 * @returns {Promise<string>}
 */
async function downloadFromGitHub(owner, repo, assetName, destPath, onProgress) {
  const release = await getGitHubRelease(owner, repo);
  const asset = release.assets.find(a => a.name === assetName);

  if (!asset) {
    throw new Error(`Asset "${assetName}" not found in release ${release.tagName}`);
  }

  return downloadFile(asset.downloadUrl, destPath, onProgress);
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract a tarball (.tar.gz, .tgz)
 * @param {string} tarballPath - Path to tarball
 * @param {string} destDir - Destination directory
 * @returns {Promise<string>} - Path to extracted directory
 */
async function extractTarball(tarballPath, destDir) {
  // Ensure destination exists
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const isWindows = process.platform === 'win32';
  const { execSync } = require('child_process');

  // Method 1: Try system tar (works on most systems)
  try {
    execSync(`tar -xzf "${tarballPath}" -C "${destDir}"`, { stdio: 'pipe' });
    return destDir;
  } catch (e) {
    // tar not available, try alternatives
  }

  // Method 2: Windows - Use PowerShell with .NET classes
  if (isWindows) {
    try {
      // First decompress .gz to .tar
      const tarPath = tarballPath.replace(/\.tgz$|\.tar\.gz$/, '.tar');

      const psScript = `
        $ErrorActionPreference = 'Stop'
        $gzPath = '${tarballPath.replace(/\\/g, '/')}'
        $tarPath = '${tarPath.replace(/\\/g, '/')}'
        $destDir = '${destDir.replace(/\\/g, '/')}'

        # Decompress gzip
        $gzStream = [System.IO.File]::OpenRead($gzPath)
        $tarStream = [System.IO.File]::Create($tarPath)
        $gzip = New-Object System.IO.Compression.GZipStream($gzStream, [System.IO.Compression.CompressionMode]::Decompress)
        $gzip.CopyTo($tarStream)
        $gzip.Close()
        $tarStream.Close()
        $gzStream.Close()

        # Extract tar using Windows tar (available in Windows 10+)
        tar -xf "$tarPath" -C "$destDir"
        Remove-Item $tarPath -Force
      `;

      execSync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
        stdio: 'pipe',
        timeout: 60000
      });
      return destDir;
    } catch (e) {
      // PowerShell method failed, try Node.js
    }
  }

  // Method 3: Pure Node.js (fallback)
  const zlib = require('zlib');
  return new Promise((resolve, reject) => {
    const gunzip = zlib.createGunzip();
    const input = fs.createReadStream(tarballPath);
    const chunks = [];

    gunzip.on('data', chunk => chunks.push(chunk));
    gunzip.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        let offset = 0;

        while (offset < buffer.length - 512) {
          const header = buffer.slice(offset, offset + 512);
          if (header.every(b => b === 0)) break;

          const name = header.slice(0, 100).toString('utf8').replace(/\0/g, '').trim();
          const sizeOctal = header.slice(124, 136).toString('utf8').replace(/\0/g, '').trim();
          const typeFlag = header[156];
          const prefix = header.slice(345, 500).toString('utf8').replace(/\0/g, '').trim();

          const size = parseInt(sizeOctal, 8) || 0;
          const fullPath = prefix ? path.join(prefix, name) : name;
          const destPath = path.join(destDir, fullPath);

          offset += 512;

          if (name && fullPath) {
            if (typeFlag === 53 || name.endsWith('/')) {
              fs.mkdirSync(destPath, { recursive: true });
            } else if (typeFlag === 0 || typeFlag === 48) {
              fs.mkdirSync(path.dirname(destPath), { recursive: true });
              fs.writeFileSync(destPath, buffer.slice(offset, offset + size));
            }
          }
          offset += Math.ceil(size / 512) * 512;
        }
        resolve(destDir);
      } catch (err) {
        reject(err);
      }
    });
    gunzip.on('error', reject);
    input.pipe(gunzip);
  });
}

/**
 * Extract a zip file
 * @param {string} zipPath - Path to zip file
 * @param {string} destDir - Destination directory
 * @returns {Promise<string>}
 */
async function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const isWindows = process.platform === 'win32';

    if (isWindows) {
      // Use PowerShell Expand-Archive
      try {
        execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, {
          stdio: 'pipe',
        });
        resolve(destDir);
      } catch (err) {
        reject(new Error(`Failed to extract zip: ${err.message}`));
      }
    } else {
      // Use unzip command
      const unzip = spawn('unzip', ['-o', zipPath, '-d', destDir], { stdio: 'pipe' });

      unzip.on('close', (code) => {
        if (code === 0) {
          resolve(destDir);
        } else {
          reject(new Error(`unzip failed with code ${code}`));
        }
      });

      unzip.on('error', reject);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Checksum Verification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate file checksum
 * @param {string} filePath
 * @param {string} [algorithm='sha256']
 * @returns {Promise<string>}
 */
async function calculateChecksum(filePath, algorithm = 'sha256') {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);

    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Verify file checksum
 * @param {string} filePath
 * @param {string} expectedHash
 * @param {string} [algorithm='sha256']
 * @returns {Promise<boolean>}
 */
async function verifyChecksum(filePath, expectedHash, algorithm = 'sha256') {
  const actualHash = await calculateChecksum(filePath, algorithm);
  return actualHash.toLowerCase() === expectedHash.toLowerCase();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMART CACHING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose: Skip downloads when local files match remote (saves bandwidth/time)
//
// How It Works:
//   1. After downloading, we save a manifest file (.atomcli-manifest.json)
//   2. Manifest contains: packageName, version, shasum, downloadDate
//   3. Before downloading, we check if local manifest matches remote
//   4. If match, skip download and use cached files
//
// Key Functions:
//   - readManifest(destDir) - Load existing manifest from directory
//   - writeManifest(destDir, data) - Save manifest after download
//   - checkIfUpToDate(destDir, packageName, version, shasum) - Compare local vs remote
//
// Manifest Structure:
//   {
//     "packageName": "@anthropic-ai/claude-code",
//     "version": "1.0.24",
//     "shasum": "abc123...",
//     "downloadedAt": "2026-01-03T10:30:00Z"
//   }
//
// Notes:
//   - Shasum check catches republished packages with same version
//   - Force download bypasses cache entirely
//   - Corrupted manifests are treated as missing (triggers redownload)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Read the download manifest from a directory
 *
 * The manifest tracks what version is currently downloaded, allowing
 * us to skip re-downloading if the remote version hasn't changed.
 *
 * @param {string} destDir - Directory containing the manifest
 * @returns {Object|null} - Manifest data or null if not found
 */
function readManifest(destDir) {
  const manifestPath = path.join(destDir, MANIFEST_FILENAME);
  try {
    if (fs.existsSync(manifestPath)) {
      const content = fs.readFileSync(manifestPath, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    // Manifest corrupted or unreadable, treat as missing
  }
  return null;
}

/**
 * Write the download manifest to a directory
 * @param {string} destDir - Directory to write manifest
 * @param {Object} data - Manifest data
 */
function writeManifest(destDir, data) {
  const manifestPath = path.join(destDir, MANIFEST_FILENAME);
  try {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    // Non-fatal: continue without caching
  }
}

/**
 * Check if local package matches remote (no download needed)
 * @param {string} destDir - Local directory
 * @param {string} packageName - npm package name
 * @param {string} remoteVersion - Latest remote version
 * @param {string} remoteShasum - Remote package shasum
 * @returns {Object} - { upToDate: boolean, localVersion, reason }
 */
function checkIfUpToDate(destDir, packageName, remoteVersion, remoteShasum) {
  const manifest = readManifest(destDir);

  if (!manifest) {
    return {
      upToDate: false,
      localVersion: null,
      reason: 'No local manifest found',
    };
  }

  // Check if same package
  if (manifest.packageName !== packageName) {
    return {
      upToDate: false,
      localVersion: manifest.version,
      reason: `Different package (local: ${manifest.packageName}, remote: ${packageName})`,
    };
  }

  // Check version match
  if (manifest.version !== remoteVersion) {
    return {
      upToDate: false,
      localVersion: manifest.version,
      reason: `Version mismatch (local: ${manifest.version}, remote: ${remoteVersion})`,
    };
  }

  // Check shasum match (integrity check)
  if (manifest.shasum && remoteShasum && manifest.shasum !== remoteShasum) {
    return {
      upToDate: false,
      localVersion: manifest.version,
      reason: `Checksum mismatch (package may have been republished)`,
    };
  }

  // Check if extracted files still exist
  const extractDir = path.join(destDir, 'package');
  if (!fs.existsSync(extractDir)) {
    return {
      upToDate: false,
      localVersion: manifest.version,
      reason: 'Extracted files missing',
    };
  }

  // All checks passed
  return {
    upToDate: true,
    localVersion: manifest.version,
    reason: 'Local version matches remote',
  };
}

/**
 * Get detailed npm package info including shasum
 * @param {string} packageName - npm package name
 * @param {string} [version] - Specific version (default: latest)
 * @returns {Promise<Object>}
 */
async function getNpmPackageVersionInfo(packageName, version = null) {
  // First get the package metadata to find latest version
  const pkgInfo = await getNpmPackageInfo(packageName);
  const targetVersion = version || pkgInfo.latestVersion;

  // Get specific version info with shasum
  const versionUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${targetVersion}`;
  const versionData = await fetchJson(versionUrl);

  return {
    name: packageName,
    version: targetVersion,
    tarball: versionData.dist?.tarball,
    shasum: versionData.dist?.shasum,
    integrity: versionData.dist?.integrity,
    latestVersion: pkgInfo.latestVersion,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// High-Level Download Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Download a CLI tool
 * @param {string} toolId - Tool ID from registry (e.g., 'claude-code')
 * @param {string} destDir - Destination directory
 * @param {Object} [options]
 * @param {string} [options.source='npm'] - Source: 'npm' or 'github'
 * @param {string} [options.version] - Specific version
 * @param {Function} [options.onProgress] - Progress callback
 * @param {Function} [options.onStatus] - Status callback
 * @param {boolean} [options.force=false] - Force download even if up-to-date
 * @returns {Promise<Object>}
 */
async function downloadTool(toolId, destDir, options = {}) {
  const { source = 'npm', version, onProgress, onStatus, force = false } = options;

  const tool = CLI_REGISTRY[toolId];
  if (!tool) {
    throw new Error(`Unknown tool: ${toolId}. Available tools: ${Object.keys(CLI_REGISTRY).join(', ')}`);
  }

  if (tool.placeholder) {
    throw new Error(`Tool "${tool.name}" is not yet implemented`);
  }

  onStatus?.(`Checking ${tool.name}...`);

  let result;

  if (source === 'npm' && tool.npm) {
    result = await downloadFromNpm(tool.npm, destDir, {
      version,
      onProgress,
      onStatus,
      force,
    });
  } else if (source === 'github' && tool.github) {
    const [owner, repo] = tool.github.split('/');
    // For GitHub, we'd need to download multiple assets
    // This is a simplified implementation
    throw new Error('GitHub source not fully implemented yet');
  } else {
    throw new Error(`Invalid source "${source}" for tool "${toolId}"`);
  }

  if (result.skipped) {
    onStatus?.(`${tool.name} v${result.version} is already up-to-date`);
  } else {
    onStatus?.(`Successfully downloaded ${tool.name} v${result.version}`);
  }

  return {
    tool: toolId,
    ...result,
  };
}

/**
 * Get list of available tools
 * @returns {Object[]}
 */
function getAvailableTools() {
  return Object.entries(CLI_REGISTRY).map(([id, tool]) => ({
    id,
    name: tool.name,
    description: tool.description,
    npm: tool.npm,
    github: tool.github,
    available: !tool.placeholder,
  }));
}

/**
 * Check if a tool needs to be downloaded/updated (without downloading)
 * @param {string} toolId - Tool ID from registry
 * @param {string} destDir - Local directory
 * @param {Object} [options]
 * @param {string} [options.version] - Specific version to check
 * @returns {Promise<Object>} - { needsUpdate, localVersion, remoteVersion, reason }
 */
async function checkForUpdates(toolId, destDir, options = {}) {
  const { version } = options;

  const tool = CLI_REGISTRY[toolId];
  if (!tool) {
    throw new Error(`Unknown tool: ${toolId}`);
  }

  if (tool.placeholder) {
    return {
      needsUpdate: false,
      error: 'Tool not yet implemented',
    };
  }

  try {
    // Get remote version info
    const pkgVersionInfo = await getNpmPackageVersionInfo(tool.npm, version);

    // Check local cache
    const cacheCheck = checkIfUpToDate(
      destDir,
      tool.npm,
      pkgVersionInfo.version,
      pkgVersionInfo.shasum
    );

    return {
      needsUpdate: !cacheCheck.upToDate,
      localVersion: cacheCheck.localVersion,
      remoteVersion: pkgVersionInfo.version,
      reason: cacheCheck.reason,
    };
  } catch (err) {
    return {
      needsUpdate: true,
      error: err.message,
      reason: 'Failed to check remote version',
    };
  }
}

/**
 * Clear local cache for a tool
 * @param {string} destDir - Directory containing cached files
 * @returns {boolean} - True if cache was cleared
 */
function clearCache(destDir) {
  const manifestPath = path.join(destDir, MANIFEST_FILENAME);
  const extractDir = path.join(destDir, 'package');

  let cleared = false;

  if (fs.existsSync(manifestPath)) {
    fs.unlinkSync(manifestPath);
    cleared = true;
  }

  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true, force: true });
    cleared = true;
  }

  return cleared;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHELL & TERMINAL DOWNLOADS
// ═══════════════════════════════════════════════════════════════════════════════
//
// Purpose: Download shells and terminals from GitHub releases
//
// Uses the registries from:
//   - components/shells/registry.js
//   - components/terminals/registry.js
//
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Download a shell from GitHub releases
 * @param {string} shellId - Shell ID from registry
 * @param {string} destDir - Destination directory
 * @param {Object} [options]
 * @param {Function} [options.onProgress] - Progress callback
 * @param {Function} [options.onStatus] - Status callback
 * @returns {Promise<Object>} Download result
 */
async function downloadShell(shellId, destDir, options = {}) {
  const { onProgress, onStatus } = options;

  // Load shell registry
  const shellRegistry = require('../shells/registry');
  const downloadInfo = shellRegistry.getShellDownloadInfo(shellId);

  if (!downloadInfo) {
    throw new Error(`Shell "${shellId}" is not downloadable`);
  }

  onStatus?.(`Checking ${downloadInfo.name} releases...`);

  const [owner, repo] = downloadInfo.github.split('/');
  const release = await getGitHubRelease(owner, repo);

  // Find matching asset
  const asset = release.assets.find(a => downloadInfo.releasePattern.test(a.name));
  if (!asset) {
    throw new Error(`No matching release asset for ${downloadInfo.name} on ${downloadInfo.platform}`);
  }

  onStatus?.(`Downloading ${asset.name}...`);

  // Create destination directory
  const shellDir = path.join(destDir, 'shells', shellId);
  if (!fs.existsSync(shellDir)) {
    fs.mkdirSync(shellDir, { recursive: true });
  }

  const downloadPath = path.join(shellDir, asset.name);
  await downloadFile(asset.downloadUrl, downloadPath, onProgress);

  // Extract if needed
  if (asset.name.endsWith('.tar.gz') || asset.name.endsWith('.tgz')) {
    onStatus?.('Extracting...');
    await extractTarball(downloadPath, shellDir);
    fs.unlinkSync(downloadPath);
  } else if (asset.name.endsWith('.zip')) {
    onStatus?.('Extracting...');
    await extractZip(downloadPath, shellDir);
    fs.unlinkSync(downloadPath);
  }

  // Save manifest
  writeManifest(shellDir, {
    type: 'shell',
    shellId,
    version: release.tagName,
    downloadedAt: new Date().toISOString(),
  });

  onStatus?.(`Successfully downloaded ${downloadInfo.name}`);

  return {
    shellId,
    name: downloadInfo.name,
    version: release.tagName,
    path: shellDir,
  };
}

/**
 * Download a terminal/TUI tool from GitHub releases
 * @param {string} terminalId - Terminal ID from registry
 * @param {string} destDir - Destination directory
 * @param {Object} [options]
 * @param {Function} [options.onProgress] - Progress callback
 * @param {Function} [options.onStatus] - Status callback
 * @returns {Promise<Object>} Download result
 */
async function downloadTerminal(terminalId, destDir, options = {}) {
  const { onProgress, onStatus } = options;

  // Load terminal registry
  const terminalRegistry = require('../terminals/registry');
  const downloadInfo = terminalRegistry.getTerminalDownloadInfo(terminalId);

  if (!downloadInfo) {
    throw new Error(`Terminal "${terminalId}" is not downloadable`);
  }

  onStatus?.(`Checking ${downloadInfo.name} releases...`);

  const [owner, repo] = downloadInfo.github.split('/');
  const release = await getGitHubRelease(owner, repo);

  // Find matching asset
  const asset = release.assets.find(a => downloadInfo.releasePattern.test(a.name));
  if (!asset) {
    throw new Error(`No matching release asset for ${downloadInfo.name} on ${downloadInfo.platform}`);
  }

  onStatus?.(`Downloading ${asset.name}...`);

  // Create destination directory
  const terminalDir = path.join(destDir, 'terminals', terminalId);
  if (!fs.existsSync(terminalDir)) {
    fs.mkdirSync(terminalDir, { recursive: true });
  }

  const downloadPath = path.join(terminalDir, asset.name);
  await downloadFile(asset.downloadUrl, downloadPath, onProgress);

  // Extract if needed
  if (asset.name.endsWith('.tar.gz') || asset.name.endsWith('.tgz')) {
    onStatus?.('Extracting...');
    await extractTarball(downloadPath, terminalDir);
    fs.unlinkSync(downloadPath);
  } else if (asset.name.endsWith('.zip')) {
    onStatus?.('Extracting...');
    await extractZip(downloadPath, terminalDir);
    fs.unlinkSync(downloadPath);
  }

  // Save manifest
  writeManifest(terminalDir, {
    type: 'terminal',
    terminalId,
    version: release.tagName,
    downloadedAt: new Date().toISOString(),
  });

  onStatus?.(`Successfully downloaded ${downloadInfo.name}`);

  return {
    terminalId,
    name: downloadInfo.name,
    type: downloadInfo.type,
    version: release.tagName,
    path: terminalDir,
  };
}

/**
 * Get list of available shells for download
 * @returns {Object[]} Array of shell info
 */
function getAvailableShellsForDownload() {
  const shellRegistry = require('../shells/registry');
  return shellRegistry.getDownloadableShells();
}

/**
 * Get list of available terminals for download
 * @returns {Object[]} Array of terminal info
 */
function getAvailableTerminalsForDownload() {
  const terminalRegistry = require('../terminals/registry');
  return terminalRegistry.getDownloadableTerminals();
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // High-level functions
  downloadTool,
  getAvailableTools,
  checkForUpdates,
  clearCache,

  // NPM functions
  getNpmPackageInfo,
  getNpmPackageVersionInfo,
  downloadFromNpm,

  // GitHub functions
  getGitHubRelease,
  downloadFromGitHub,

  // Low-level functions
  downloadFile,
  fetchJson,
  extractTarball,
  extractZip,

  // Verification & Cache
  calculateChecksum,
  verifyChecksum,
  readManifest,
  writeManifest,
  checkIfUpToDate,

  // Registry
  CLI_REGISTRY,

  // Shell & Terminal downloads
  downloadShell,
  downloadTerminal,
  getAvailableShellsForDownload,
  getAvailableTerminalsForDownload,
};
