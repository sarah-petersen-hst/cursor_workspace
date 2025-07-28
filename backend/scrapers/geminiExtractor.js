// geminiExtractor.js - Extract event metadata from HTML using Gemini API
// Legal/Ethical: Only send minimal, relevant text to LLM

const axios = require('axios');

/**
 * Extract event metadata from HTML using Gemini API.
 * @param {string} html - The HTML content
 * @param {string} url - The source URL (for context)
 * @returns {Promise<object>} - Extracted event metadata
 */
async function extractEventMetadata(html, url) {
  // TODO: Use Gemini API key from env
  // TODO: Construct a prompt to extract:
  // - Event title
  // - Dance style(s)
  // - Date/time (workshops, party)
  // - Venue address
  // - Recurrence (normalize)
  // - Venue type (indoor/outdoor/unspecified)
  // - Source URL
  // Only return structured metadata
  return {};
}

module.exports = { extractEventMetadata }; 