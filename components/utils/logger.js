/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                           ATOMCLI - LOGGER MODULE                            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Structured logging with levels, timestamps, and rich formatting             ║
 * ║                                                                              ║
 * ║  Log Levels:                                                                 ║
 * ║  - DEBUG   (0) : Detailed debugging information                              ║
 * ║  - INFO    (1) : General information messages                                ║
 * ║  - SUCCESS (2) : Success confirmations                                       ║
 * ║  - WARN    (3) : Warning messages                                            ║
 * ║  - ERROR   (4) : Error messages                                              ║
 * ║  - FATAL   (5) : Critical errors that stop execution                         ║
 * ║                                                                              ║
 * ║  Usage:                                                                      ║
 * ║    const log = require('./logger');                                          ║
 * ║    log.info('Starting build...');                                            ║
 * ║    log.success('Build complete!');                                           ║
 * ║    log.error('Build failed', { code: 1 });                                   ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

const { colors, theme, box } = require('./colors');

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  SUCCESS: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5,
};

let currentLevel = LOG_LEVELS.INFO;
let showTimestamps = false;
let logFile = null;

// ─────────────────────────────────────────────────────────────────────────────
// Icons & Prefixes
// ─────────────────────────────────────────────────────────────────────────────

const ICONS = {
  DEBUG: colors.gray('●'),
  INFO: colors.blue('ℹ'),
  SUCCESS: colors.green('✓'),
  WARN: colors.yellow('⚠'),
  ERROR: colors.red('✗'),
  FATAL: colors.bgRed(colors.white(' FATAL ')),
  ARROW: colors.cyan('→'),
  BULLET: colors.gray('•'),
  STAR: colors.yellow('★'),
  CHECK: colors.green('✔'),
  CROSS: colors.red('✘'),
  SPINNER: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Formatting Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get current timestamp
 * @returns {string}
 */
function getTimestamp() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return colors.gray(`[${hours}:${minutes}:${seconds}]`);
}

/**
 * Format log message
 * @param {string} level - Log level
 * @param {string} message - Message to log
 * @param {Object} [data] - Additional data
 * @returns {string}
 */
function formatMessage(level, message, data = null) {
  const parts = [];

  if (showTimestamps) {
    parts.push(getTimestamp());
  }

  parts.push(ICONS[level] || '');
  parts.push(message);

  if (data) {
    const dataStr = typeof data === 'object'
      ? JSON.stringify(data, null, 2)
      : String(data);
    parts.push(colors.gray(dataStr));
  }

  return parts.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Logger Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log debug message
 * @param {string} message
 * @param {Object} [data]
 */
function debug(message, data) {
  if (currentLevel <= LOG_LEVELS.DEBUG) {
    console.log(formatMessage('DEBUG', colors.gray(message), data));
  }
}

/**
 * Log info message
 * @param {string} message
 * @param {Object} [data]
 */
function info(message, data) {
  if (currentLevel <= LOG_LEVELS.INFO) {
    console.log(formatMessage('INFO', message, data));
  }
}

/**
 * Log success message
 * @param {string} message
 * @param {Object} [data]
 */
function success(message, data) {
  if (currentLevel <= LOG_LEVELS.SUCCESS) {
    console.log(formatMessage('SUCCESS', colors.green(message), data));
  }
}

/**
 * Log warning message
 * @param {string} message
 * @param {Object} [data]
 */
function warn(message, data) {
  if (currentLevel <= LOG_LEVELS.WARN) {
    console.log(formatMessage('WARN', colors.yellow(message), data));
  }
}

/**
 * Log error message
 * @param {string} message
 * @param {Object} [data]
 */
function error(message, data) {
  if (currentLevel <= LOG_LEVELS.ERROR) {
    console.error(formatMessage('ERROR', colors.red(message), data));
  }
}

/**
 * Log fatal message and optionally exit
 * @param {string} message
 * @param {Object} [data]
 * @param {boolean} [exit=true]
 */
function fatal(message, data, exit = true) {
  console.error(formatMessage('FATAL', colors.red(message), data));
  if (exit) {
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Special Formatting Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log a section header
 * @param {string} title
 */
function header(title) {
  const width = Math.max(title.length + 4, 50);
  const padding = Math.floor((width - title.length - 2) / 2);
  const paddingStr = ' '.repeat(padding);

  console.log('');
  console.log(theme.primary(box.doubleTopLeft + box.doubleHorizontal.repeat(width) + box.doubleTopRight));
  console.log(theme.primary(box.doubleVertical) + paddingStr + colors.bold(title) + paddingStr + theme.primary(box.doubleVertical));
  console.log(theme.primary(box.doubleBottomLeft + box.doubleHorizontal.repeat(width) + box.doubleBottomRight));
  console.log('');
}

/**
 * Log a divider line
 * @param {string} [char='─']
 * @param {number} [length=50]
 */
function divider(char = '─', length = 50) {
  console.log(colors.gray(char.repeat(length)));
}

/**
 * Log a list of items
 * @param {string[]} items
 * @param {string} [bullet='•']
 */
function list(items, bullet = '•') {
  items.forEach(item => {
    console.log(`  ${colors.cyan(bullet)} ${item}`);
  });
}

/**
 * Log a key-value pair
 * @param {string} key
 * @param {string} value
 * @param {number} [keyWidth=20]
 */
function keyValue(key, value, keyWidth = 20) {
  const paddedKey = key.padEnd(keyWidth);
  console.log(`  ${colors.cyan(paddedKey)} ${value}`);
}

/**
 * Log a step in a process
 * @param {number} step - Step number
 * @param {number} total - Total steps
 * @param {string} message
 */
function step(stepNum, total, message) {
  const stepStr = colors.cyan(`[${stepNum}/${total}]`);
  console.log(`${stepStr} ${message}`);
}

/**
 * Log a box with content
 * @param {string|string[]} content
 * @param {string} [title]
 */
function boxed(content, title = '') {
  const lines = Array.isArray(content) ? content : content.split('\n');
  const maxWidth = Math.max(...lines.map(l => l.length), title.length) + 4;

  console.log('');

  // Top border
  if (title) {
    const titlePadding = maxWidth - title.length - 2;
    console.log(
      colors.gray(box.topLeft) +
      colors.gray(box.horizontal) +
      colors.cyan(` ${title} `) +
      colors.gray(box.horizontal.repeat(titlePadding - 2)) +
      colors.gray(box.topRight)
    );
  } else {
    console.log(colors.gray(box.topLeft + box.horizontal.repeat(maxWidth) + box.topRight));
  }

  // Content
  lines.forEach(line => {
    const padding = maxWidth - line.length - 2;
    console.log(colors.gray(box.vertical) + ' ' + line + ' '.repeat(padding) + ' ' + colors.gray(box.vertical));
  });

  // Bottom border
  console.log(colors.gray(box.bottomLeft + box.horizontal.repeat(maxWidth) + box.bottomRight));
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress Indicators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a progress bar
 * @param {number} current
 * @param {number} total
 * @param {number} [width=30]
 * @returns {string}
 */
function progressBar(current, total, width = 30) {
  const percentage = Math.min(100, Math.floor((current / total) * 100));
  const filled = Math.floor((percentage / 100) * width);
  const empty = width - filled;

  const bar =
    colors.green(box.progressFull.repeat(filled)) +
    colors.gray(box.progressEmpty.repeat(empty));

  return `${bar} ${percentage}%`;
}

/**
 * Create a spinner instance
 * @param {string} message
 * @returns {Object}
 */
function spinner(message) {
  let frameIndex = 0;
  let interval = null;

  return {
    start() {
      process.stdout.write('\x1B[?25l'); // Hide cursor
      interval = setInterval(() => {
        const frame = ICONS.SPINNER[frameIndex];
        process.stdout.write(`\r${colors.cyan(frame)} ${message}`);
        frameIndex = (frameIndex + 1) % ICONS.SPINNER.length;
      }, 80);
    },
    stop(finalMessage, isSuccess = true) {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      process.stdout.write('\x1B[?25h'); // Show cursor
      const icon = isSuccess ? ICONS.SUCCESS : ICONS.ERROR;
      console.log(`\r${icon} ${finalMessage}`);
    },
    update(newMessage) {
      message = newMessage;
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set log level
 * @param {string|number} level
 */
function setLevel(level) {
  if (typeof level === 'string') {
    currentLevel = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.INFO;
  } else {
    currentLevel = level;
  }
}

/**
 * Enable/disable timestamps
 * @param {boolean} enabled
 */
function setTimestamps(enabled) {
  showTimestamps = enabled;
}

/**
 * Get current log level
 * @returns {number}
 */
function getLevel() {
  return currentLevel;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Log functions
  debug,
  info,
  success,
  warn,
  error,
  fatal,

  // Formatting
  header,
  divider,
  list,
  keyValue,
  step,
  boxed,

  // Progress
  progressBar,
  spinner,

  // Configuration
  setLevel,
  setTimestamps,
  getLevel,

  // Constants
  LOG_LEVELS,
  ICONS,
};
