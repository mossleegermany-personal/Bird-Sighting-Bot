/**
 * Markdown utilities — escape user/API text for safe embedding in
 * Telegram Markdown (v1) messages without breaking formatting.
 *
 * Telegram MarkdownV1 special characters: * _ ` [
 * We escape them with a backslash so they render as literal text.
 *
 * Usage:
 *   const { esc } = require('../../utils/markdown');
 *   await this.sendMessage(chatId, `Searching for *${esc(userInput)}*...`);
 *
 * The raw (unescaped) value should still be used for API calls, cache keys,
 * and callback_data — only escape when building display strings.
 */

/**
 * Escape Telegram MarkdownV1 special characters in a string.
 * @param {string} text - Raw text to escape
 * @returns {string} Escaped text safe for Markdown embedding
 */
function escapeMarkdown(text) {
  if (!text) return '';
  return String(text).replace(/([*_`\[])/g, '\\$1');
}

// Short alias for concise inline usage
const esc = escapeMarkdown;

module.exports = { escapeMarkdown, esc };
