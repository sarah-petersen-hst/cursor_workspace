// geminiExtractor.js - Extract event metadata from HTML using Gemini API
// Legal/Ethical: Only send minimal, relevant text to LLM

const axios = require('axios');
require('dotenv').config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Extract event metadata from HTML using Gemini API.
 * @param {string} html - The HTML content
 * @param {string} url - The source URL (for context)
 * @returns {Promise<object>} - Extracted event metadata
 */
async function extractEventMetadata(html, url) {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key missing');
  // Use only the first 10,000 characters for prompt
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 10000);
  const prompt = `Extract the following metadata for a Salsa dance event from the provided German web page text. Return a JSON object with these fields:
- name (event title)
- styles (array of dance styles)
- date (ISO 8601 or human-readable)
- workshops (array: {start, end, style, level})
- party (object: {start, end, floors})
- address (venue address)
- source_url (the URL)
- recurrence (e.g., 'every Tuesday', 'every second Friday', etc., normalized)
- venue_type ('Indoor', 'Outdoor', or 'Unspecified')

Text:
${text}

URL: ${url}`;
  const response = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
    contents: [{ parts: [{ text: prompt }] }]
  }, {
    params: { key: GEMINI_API_KEY },
    headers: { 'Content-Type': 'application/json' }
  });
  // Parse JSON from LLM response
  const match = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

module.exports = { extractEventMetadata }; 