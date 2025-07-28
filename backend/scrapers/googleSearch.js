// googleSearch.js - Google Search for Salsa event queries
// Uses Google Custom Search JSON API
// Only fetch results from page 1, .de domains

const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.GOOGLE_API_KEY;
const CX = process.env.GOOGLE_CX;

/**
 * Perform a Google search for Salsa event queries in Germany.
 * @param {string} query - The search query (e.g., 'Salsa Veranstaltung Dienstag Berlin site:.de')
 * @returns {Promise<string[]>} - Array of result URLs (page 1 only, .de domains)
 */
async function googleSearch(query) {
  if (!API_KEY || !CX) throw new Error('Google API key or CX missing');
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${API_KEY}&cx=${CX}`;
  try {
    const res = await axios.get(url);
    if (!res.data.items) return [];
    // Only return .de domains
    return res.data.items
      .map(item => item.link)
      .filter(link => link.includes('.de'));
  } catch (err) {
    console.error('Google Search API error:', err.response?.data || err.message);
    return [];
  }
}

module.exports = { googleSearch }; 