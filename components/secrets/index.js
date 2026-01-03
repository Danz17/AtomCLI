/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                        ATOMCLI - SECRETS MANAGER                             ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Secure storage for API keys, tokens, and credentials                        ║
 * ║                                                                              ║
 * ║  Supported Providers:                                                        ║
 * ║  - Windows: Credential Manager (cmdkey)                                      ║
 * ║  - macOS: Keychain (security)                                                ║
 * ║  - Linux: Secret Service (secret-tool)                                       ║
 * ║  - Fallback: Encrypted file storage                                          ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════════════════════
// SECRET TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Predefined secret types for AI CLI tools
 */
const SECRET_TYPES = {
  // Claude/Anthropic
  'claude': {
    service: 'anthropic',
    env: 'ANTHROPIC_API_KEY',
    label: 'Anthropic API Key',
    description: 'API key for Claude Code (Anthropic)',
    format: /^sk-ant-[a-zA-Z0-9_-]+$/,
  },

  // OpenAI/Codex
  'openai': {
    service: 'openai',
    env: 'OPENAI_API_KEY',
    label: 'OpenAI API Key',
    description: 'API key for OpenAI Codex',
    format: /^sk-[a-zA-Z0-9]+$/,
  },

  // GitHub/Copilot
  'github': {
    service: 'github',
    env: 'GITHUB_TOKEN',
    label: 'GitHub Token',
    description: 'Personal access token for GitHub Copilot',
    format: /^gh[ps]_[a-zA-Z0-9]+$/,
  },

  // Google/Gemini
  'google': {
    service: 'google',
    env: 'GOOGLE_API_KEY',
    label: 'Google API Key',
    description: 'API key for Google Gemini',
    format: /^AIza[a-zA-Z0-9_-]+$/,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the keychain provider for the current platform
 * @returns {string} 'credential-manager', 'keychain', 'secret-tool', or 'file'
 */
function getProvider() {
  switch (process.platform) {
    case 'win32':
      return 'credential-manager';
    case 'darwin':
      return 'keychain';
    case 'linux':
      // Check if secret-tool is available
      try {
        execSync('which secret-tool', { stdio: 'pipe' });
        return 'secret-tool';
      } catch (e) {
        return 'file';
      }
    default:
      return 'file';
  }
}

/**
 * Check if system keychain is available
 * @returns {Object} { available: boolean, provider: string, reason: string }
 */
function checkKeychainAvailable() {
  const provider = getProvider();

  switch (provider) {
    case 'credential-manager':
      try {
        execSync('cmdkey /list', { stdio: 'pipe' });
        return { available: true, provider, reason: 'Windows Credential Manager available' };
      } catch (e) {
        return { available: false, provider: 'file', reason: 'cmdkey not available' };
      }

    case 'keychain':
      try {
        execSync('security help', { stdio: 'pipe' });
        return { available: true, provider, reason: 'macOS Keychain available' };
      } catch (e) {
        return { available: false, provider: 'file', reason: 'security command not available' };
      }

    case 'secret-tool':
      try {
        execSync('secret-tool --version', { stdio: 'pipe' });
        return { available: true, provider, reason: 'Linux Secret Service available' };
      } catch (e) {
        return { available: false, provider: 'file', reason: 'secret-tool not available' };
      }

    default:
      return { available: false, provider: 'file', reason: 'Using encrypted file storage' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WINDOWS CREDENTIAL MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Store secret in Windows Credential Manager
 * @param {string} service - Service name
 * @param {string} secret - Secret value
 * @returns {boolean} Success
 */
function windowsStoreSecret(service, secret) {
  const target = `atomcli_${service}`;
  try {
    // First delete if exists
    try {
      execSync(`cmdkey /delete:${target}`, { stdio: 'pipe' });
    } catch (e) {}

    // Store new credential
    execSync(`cmdkey /generic:${target} /user:apikey /pass:${secret}`, { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Retrieve secret from Windows Credential Manager
 * @param {string} service - Service name
 * @returns {string|null} Secret value or null
 */
function windowsGetSecret(service) {
  const target = `atomcli_${service}`;
  try {
    // Use PowerShell to read credential (cmdkey can't read passwords)
    const psCommand = `
      $cred = Get-StoredCredential -Target "${target}" -ErrorAction SilentlyContinue
      if ($cred) { $cred.GetNetworkCredential().Password }
    `;
    const result = execSync(`powershell -Command "${psCommand.replace(/\n/g, ' ')}"`, { stdio: 'pipe' }).toString().trim();
    return result || null;
  } catch (e) {
    // Try alternative method using CredentialManager module or VaultCmd
    return windowsGetSecretAlternative(service);
  }
}

/**
 * Alternative Windows credential retrieval
 * @param {string} service - Service name
 * @returns {string|null} Secret value or null
 */
function windowsGetSecretAlternative(service) {
  // Fallback: check if stored in registry or file
  return null;
}

/**
 * Delete secret from Windows Credential Manager
 * @param {string} service - Service name
 * @returns {boolean} Success
 */
function windowsDeleteSecret(service) {
  const target = `atomcli_${service}`;
  try {
    execSync(`cmdkey /delete:${target}`, { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * List secrets in Windows Credential Manager
 * @returns {string[]} Array of service names
 */
function windowsListSecrets() {
  try {
    const result = execSync('cmdkey /list', { stdio: 'pipe' }).toString();
    const matches = result.match(/atomcli_(\w+)/g) || [];
    return matches.map(m => m.replace('atomcli_', ''));
  } catch (e) {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MACOS KEYCHAIN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Store secret in macOS Keychain
 * @param {string} service - Service name
 * @param {string} secret - Secret value
 * @returns {boolean} Success
 */
function macosStoreSecret(service, secret) {
  try {
    // Delete existing if present
    try {
      execSync(`security delete-generic-password -s atomcli_${service} 2>/dev/null`, { stdio: 'pipe' });
    } catch (e) {}

    // Add new password
    execSync(`security add-generic-password -s atomcli_${service} -a apikey -w "${secret}"`, { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Retrieve secret from macOS Keychain
 * @param {string} service - Service name
 * @returns {string|null} Secret value or null
 */
function macosGetSecret(service) {
  try {
    const result = execSync(`security find-generic-password -s atomcli_${service} -w 2>/dev/null`, { stdio: 'pipe' }).toString().trim();
    return result || null;
  } catch (e) {
    return null;
  }
}

/**
 * Delete secret from macOS Keychain
 * @param {string} service - Service name
 * @returns {boolean} Success
 */
function macosDeleteSecret(service) {
  try {
    execSync(`security delete-generic-password -s atomcli_${service}`, { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * List secrets in macOS Keychain
 * @returns {string[]} Array of service names
 */
function macosListSecrets() {
  try {
    const result = execSync('security dump-keychain 2>/dev/null | grep atomcli_', { stdio: 'pipe' }).toString();
    const matches = result.match(/atomcli_(\w+)/g) || [];
    return [...new Set(matches.map(m => m.replace('atomcli_', '')))];
  } catch (e) {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LINUX SECRET SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Store secret using Linux secret-tool
 * @param {string} service - Service name
 * @param {string} secret - Secret value
 * @returns {boolean} Success
 */
function linuxStoreSecret(service, secret) {
  try {
    const result = spawnSync('secret-tool', [
      'store',
      '--label', `AtomCLI ${service}`,
      'service', `atomcli_${service}`,
      'account', 'apikey',
    ], {
      input: secret,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.status === 0;
  } catch (e) {
    return false;
  }
}

/**
 * Retrieve secret using Linux secret-tool
 * @param {string} service - Service name
 * @returns {string|null} Secret value or null
 */
function linuxGetSecret(service) {
  try {
    const result = execSync(`secret-tool lookup service atomcli_${service}`, { stdio: 'pipe' }).toString().trim();
    return result || null;
  } catch (e) {
    return null;
  }
}

/**
 * Delete secret using Linux secret-tool
 * @param {string} service - Service name
 * @returns {boolean} Success
 */
function linuxDeleteSecret(service) {
  try {
    execSync(`secret-tool clear service atomcli_${service}`, { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * List secrets using Linux secret-tool
 * @returns {string[]} Array of service names
 */
function linuxListSecrets() {
  try {
    const result = execSync('secret-tool search --all service atomcli 2>/dev/null | grep "^attribute.service"', { stdio: 'pipe' }).toString();
    const matches = result.match(/atomcli_(\w+)/g) || [];
    return [...new Set(matches.map(m => m.replace('atomcli_', '')))];
  } catch (e) {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE-BASED FALLBACK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get secrets file path
 * @returns {string} Path to encrypted secrets file
 */
function getSecretsFilePath() {
  const configDir = path.join(os.homedir(), '.atomcli');
  return path.join(configDir, '.secrets.enc');
}

/**
 * Get or create encryption key
 * @returns {Buffer} 32-byte key
 */
function getEncryptionKey() {
  const keyPath = path.join(os.homedir(), '.atomcli', '.key');
  const configDir = path.dirname(keyPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }

  if (fs.existsSync(keyPath)) {
    return Buffer.from(fs.readFileSync(keyPath, 'utf8'), 'hex');
  }

  // Generate new key
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, key.toString('hex'), { mode: 0o600 });
  return key;
}

/**
 * Encrypt data
 * @param {string} data - Data to encrypt
 * @returns {string} Encrypted data (iv:encrypted)
 */
function encrypt(data) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt data
 * @param {string} data - Encrypted data (iv:encrypted)
 * @returns {string} Decrypted data
 */
function decrypt(data) {
  const key = getEncryptionKey();
  const [ivHex, encrypted] = data.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Load secrets from file
 * @returns {Object} Secrets object
 */
function loadSecretsFile() {
  const filePath = getSecretsFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const encrypted = fs.readFileSync(filePath, 'utf8');
      const decrypted = decrypt(encrypted);
      return JSON.parse(decrypted);
    }
  } catch (e) {}
  return {};
}

/**
 * Save secrets to file
 * @param {Object} secrets - Secrets object
 */
function saveSecretsFile(secrets) {
  const filePath = getSecretsFilePath();
  const configDir = path.dirname(filePath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }

  const json = JSON.stringify(secrets);
  const encrypted = encrypt(json);
  fs.writeFileSync(filePath, encrypted, { mode: 0o600 });
}

/**
 * Store secret in file
 * @param {string} service - Service name
 * @param {string} secret - Secret value
 * @returns {boolean} Success
 */
function fileStoreSecret(service, secret) {
  try {
    const secrets = loadSecretsFile();
    secrets[service] = secret;
    saveSecretsFile(secrets);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Retrieve secret from file
 * @param {string} service - Service name
 * @returns {string|null} Secret value or null
 */
function fileGetSecret(service) {
  try {
    const secrets = loadSecretsFile();
    return secrets[service] || null;
  } catch (e) {
    return null;
  }
}

/**
 * Delete secret from file
 * @param {string} service - Service name
 * @returns {boolean} Success
 */
function fileDeleteSecret(service) {
  try {
    const secrets = loadSecretsFile();
    delete secrets[service];
    saveSecretsFile(secrets);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * List secrets in file
 * @returns {string[]} Array of service names
 */
function fileListSecrets() {
  try {
    const secrets = loadSecretsFile();
    return Object.keys(secrets);
  } catch (e) {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Store a secret
 * @param {string} service - Service name (e.g., 'claude', 'openai')
 * @param {string} secret - Secret value
 * @returns {Object} { success: boolean, provider: string }
 */
function storeSecret(service, secret) {
  const provider = getProvider();

  let success = false;
  switch (provider) {
    case 'credential-manager':
      success = windowsStoreSecret(service, secret);
      break;
    case 'keychain':
      success = macosStoreSecret(service, secret);
      break;
    case 'secret-tool':
      success = linuxStoreSecret(service, secret);
      break;
    default:
      success = fileStoreSecret(service, secret);
  }

  return { success, provider };
}

/**
 * Retrieve a secret
 * @param {string} service - Service name
 * @returns {Object} { secret: string|null, provider: string }
 */
function getSecret(service) {
  const provider = getProvider();

  let secret = null;
  switch (provider) {
    case 'credential-manager':
      secret = windowsGetSecret(service);
      break;
    case 'keychain':
      secret = macosGetSecret(service);
      break;
    case 'secret-tool':
      secret = linuxGetSecret(service);
      break;
    default:
      secret = fileGetSecret(service);
  }

  return { secret, provider };
}

/**
 * Delete a secret
 * @param {string} service - Service name
 * @returns {Object} { success: boolean, provider: string }
 */
function deleteSecret(service) {
  const provider = getProvider();

  let success = false;
  switch (provider) {
    case 'credential-manager':
      success = windowsDeleteSecret(service);
      break;
    case 'keychain':
      success = macosDeleteSecret(service);
      break;
    case 'secret-tool':
      success = linuxDeleteSecret(service);
      break;
    default:
      success = fileDeleteSecret(service);
  }

  return { success, provider };
}

/**
 * List all stored secrets
 * @returns {Object} { services: string[], provider: string }
 */
function listSecrets() {
  const provider = getProvider();

  let services = [];
  switch (provider) {
    case 'credential-manager':
      services = windowsListSecrets();
      break;
    case 'keychain':
      services = macosListSecrets();
      break;
    case 'secret-tool':
      services = linuxListSecrets();
      break;
    default:
      services = fileListSecrets();
  }

  return { services, provider };
}

/**
 * Get environment variables for secrets
 * @returns {Object} Environment variables object
 */
function getSecretsAsEnv() {
  const env = {};

  for (const [key, config] of Object.entries(SECRET_TYPES)) {
    const { secret } = getSecret(key);
    if (secret) {
      env[config.env] = secret;
    }
  }

  return env;
}

/**
 * Validate secret format
 * @param {string} secretType - Secret type (e.g., 'claude', 'openai')
 * @param {string} secret - Secret value
 * @returns {Object} { valid: boolean, reason: string }
 */
function validateSecret(secretType, secret) {
  const config = SECRET_TYPES[secretType];
  if (!config) {
    return { valid: false, reason: 'Unknown secret type' };
  }

  if (!secret || secret.length === 0) {
    return { valid: false, reason: 'Secret is empty' };
  }

  if (config.format && !config.format.test(secret)) {
    return { valid: false, reason: `Invalid format for ${config.label}` };
  }

  return { valid: true, reason: 'OK' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Types
  SECRET_TYPES,

  // Provider
  getProvider,
  checkKeychainAvailable,

  // Unified API
  storeSecret,
  getSecret,
  deleteSecret,
  listSecrets,
  getSecretsAsEnv,
  validateSecret,

  // File-based (for testing)
  getSecretsFilePath,
  loadSecretsFile,
  saveSecretsFile,
};
