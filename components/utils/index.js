/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                          ATOMCLI - UTILS MODULE                              ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Central utility module that exports all utility functions                   ║
 * ║                                                                              ║
 * ║  Sub-modules:                                                                ║
 * ║  - colors   : Terminal colors and styling                                    ║
 * ║  - logger   : Structured logging with rich formatting                        ║
 * ║  - platform : Platform detection and dependency checking                     ║
 * ║                                                                              ║
 * ║  Usage:                                                                      ║
 * ║    const { colors, log, platform } = require('./components/utils');          ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

const colors = require('./colors');
const logger = require('./logger');
const platform = require('./platform');

// ─────────────────────────────────────────────────────────────────────────────
// Re-export all modules
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Colors module
  colors: colors.colors,
  style: colors.style,
  theme: colors.theme,
  box: colors.box,
  rgb: colors.rgb,
  bgRgb: colors.bgRgb,

  // Logger module (aliased as 'log' for convenience)
  log: logger,
  logger,

  // Platform module
  platform,

  // Direct access to sub-modules
  modules: {
    colors,
    logger,
    platform,
  },
};
