/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                           ATOMCLI - COLORS MODULE                            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Terminal color utilities for rich TUI rendering                             ║
 * ║                                                                              ║
 * ║  Features:                                                                   ║
 * ║  - ANSI 256 color support                                                    ║
 * ║  - RGB true color support                                                    ║
 * ║  - Automatic terminal capability detection                                   ║
 * ║  - Fallback for non-color terminals                                          ║
 * ║                                                                              ║
 * ║  Usage:                                                                      ║
 * ║    const { colors, style } = require('./colors');                            ║
 * ║    console.log(colors.green('Success!'));                                    ║
 * ║    console.log(style.bold.red('Error!'));                                    ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// ANSI Escape Codes
// ─────────────────────────────────────────────────────────────────────────────

const ESC = '\x1b[';
const RESET = `${ESC}0m`;

/**
 * Check if terminal supports colors
 * @returns {boolean}
 */
function supportsColor() {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  if (process.platform === 'win32') {
    // Windows 10 build 14393+ supports ANSI
    const osRelease = require('os').release().split('.');
    if (parseInt(osRelease[0], 10) >= 10 && parseInt(osRelease[2], 10) >= 14393) {
      return true;
    }
  }
  return process.stdout.isTTY || false;
}

const COLORS_ENABLED = supportsColor();

// ─────────────────────────────────────────────────────────────────────────────
// Color Definitions
// ─────────────────────────────────────────────────────────────────────────────

const CODES = {
  // Reset
  reset: [0, 0],

  // Styles
  bold: [1, 22],
  dim: [2, 22],
  italic: [3, 23],
  underline: [4, 24],
  blink: [5, 25],
  inverse: [7, 27],
  hidden: [8, 28],
  strikethrough: [9, 29],

  // Foreground Colors
  black: [30, 39],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  blue: [34, 39],
  magenta: [35, 39],
  cyan: [36, 39],
  white: [37, 39],
  gray: [90, 39],
  grey: [90, 39],

  // Bright Foreground Colors
  brightRed: [91, 39],
  brightGreen: [92, 39],
  brightYellow: [93, 39],
  brightBlue: [94, 39],
  brightMagenta: [95, 39],
  brightCyan: [96, 39],
  brightWhite: [97, 39],

  // Background Colors
  bgBlack: [40, 49],
  bgRed: [41, 49],
  bgGreen: [42, 49],
  bgYellow: [43, 49],
  bgBlue: [44, 49],
  bgMagenta: [45, 49],
  bgCyan: [46, 49],
  bgWhite: [47, 49],
  bgGray: [100, 49],

  // Bright Background Colors
  bgBrightRed: [101, 49],
  bgBrightGreen: [102, 49],
  bgBrightYellow: [103, 49],
  bgBrightBlue: [104, 49],
  bgBrightMagenta: [105, 49],
  bgBrightCyan: [106, 49],
  bgBrightWhite: [107, 49],
};

// ─────────────────────────────────────────────────────────────────────────────
// Color Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a color function
 * @param {number} open - Opening code
 * @param {number} close - Closing code
 * @returns {Function}
 */
function createColor(open, close) {
  return (text) => {
    if (!COLORS_ENABLED) return text;
    return `${ESC}${open}m${text}${ESC}${close}m`;
  };
}

/**
 * Create RGB foreground color
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {Function}
 */
function rgb(r, g, b) {
  return (text) => {
    if (!COLORS_ENABLED) return text;
    return `${ESC}38;2;${r};${g};${b}m${text}${RESET}`;
  };
}

/**
 * Create RGB background color
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {Function}
 */
function bgRgb(r, g, b) {
  return (text) => {
    if (!COLORS_ENABLED) return text;
    return `${ESC}48;2;${r};${g};${b}m${text}${RESET}`;
  };
}

/**
 * Create 256 color
 * @param {number} code - Color code (0-255)
 * @returns {Function}
 */
function color256(code) {
  return (text) => {
    if (!COLORS_ENABLED) return text;
    return `${ESC}38;5;${code}m${text}${RESET}`;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build Colors Object
// ─────────────────────────────────────────────────────────────────────────────

const colors = {};
for (const [name, [open, close]] of Object.entries(CODES)) {
  colors[name] = createColor(open, close);
}

// Add RGB and 256 color support
colors.rgb = rgb;
colors.bgRgb = bgRgb;
colors.color256 = color256;

// ─────────────────────────────────────────────────────────────────────────────
// Chainable Style Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create chainable style object
 * Allows: style.bold.red.bgWhite('text')
 */
function createStyleBuilder() {
  const builder = {};
  const appliedStyles = [];

  const handler = {
    get(target, prop) {
      if (prop === 'apply' || typeof prop === 'symbol') {
        return target[prop];
      }

      if (CODES[prop]) {
        appliedStyles.push(prop);
        return new Proxy(function(text) {
          if (!COLORS_ENABLED) return text;
          let result = text;
          for (const styleName of appliedStyles) {
            const [open, close] = CODES[styleName];
            result = `${ESC}${open}m${result}${ESC}${close}m`;
          }
          appliedStyles.length = 0; // Reset for next use
          return result;
        }, handler);
      }

      return target[prop];
    }
  };

  return new Proxy(builder, handler);
}

const style = createStyleBuilder();

// ─────────────────────────────────────────────────────────────────────────────
// Theme Colors (AtomCLI Brand)
// ─────────────────────────────────────────────────────────────────────────────

const theme = {
  // Primary colors
  primary: rgb(86, 156, 214),      // Blue
  secondary: rgb(78, 201, 176),    // Teal
  accent: rgb(206, 145, 120),      // Orange

  // Status colors
  success: rgb(76, 175, 80),       // Green
  warning: rgb(255, 193, 7),       // Yellow
  error: rgb(244, 67, 54),         // Red
  info: rgb(33, 150, 243),         // Light Blue

  // UI colors
  border: rgb(68, 68, 68),         // Dark gray
  highlight: rgb(38, 79, 120),     // Highlight blue
  muted: rgb(128, 128, 128),       // Gray

  // Text colors
  text: rgb(212, 212, 212),        // Light gray
  textDim: rgb(128, 128, 128),     // Dim gray
  textBright: rgb(255, 255, 255),  // White
};

// ─────────────────────────────────────────────────────────────────────────────
// Box Drawing Characters
// ─────────────────────────────────────────────────────────────────────────────

const box = {
  // Single line
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  leftT: '├',
  rightT: '┤',
  topT: '┬',
  bottomT: '┴',
  cross: '┼',

  // Double line
  doubleTopLeft: '╔',
  doubleTopRight: '╗',
  doubleBottomLeft: '╚',
  doubleBottomRight: '╝',
  doubleHorizontal: '═',
  doubleVertical: '║',

  // Rounded
  roundTopLeft: '╭',
  roundTopRight: '╮',
  roundBottomLeft: '╰',
  roundBottomRight: '╯',

  // Block elements
  fullBlock: '█',
  lightShade: '░',
  mediumShade: '▒',
  darkShade: '▓',

  // Progress bar
  progressFull: '█',
  progressEmpty: '░',
  progressHalf: '▌',
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  colors,
  style,
  theme,
  box,
  rgb,
  bgRgb,
  color256,
  supportsColor,
  COLORS_ENABLED,
  RESET,
  ESC,
};
