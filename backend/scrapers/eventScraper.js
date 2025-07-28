// eventScraper.js - Fetch and parse event page HTML
// Legal/Ethical: Only fetch if allowed by robots.txt, use delay and custom user-agent

const axios = require('axios');

/**
 * Fetch HTML content from a URL with delay and custom user-agent.
 * @param {string} url - The URL to fetch
 * @returns {Promise<string>} - The HTML content
 */
async function fetchEventPage(url) {
  await new Promise(res => setTimeout(res, 2000)); // 2s delay
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'TanzpartyBot/1.0 (+https://deineseite.de/bot-info)'
    },
    timeout: 10000
  });
  return response.data;
}

module.exports = { fetchEventPage }; 