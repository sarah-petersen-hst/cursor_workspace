// eventScraper.js - Fetch and parse event page HTML
// Legal/Ethical: Only fetch if allowed by robots.txt, use delay and custom user-agent

const axios = require('axios');

/**
 * Check if the HTML contains whitelisted event terms and not blacklisted terms.
 * @param {string} html
 * @returns {boolean}
 */
function isRelevantEventPage(html) {
  const whitelist = [
    'Social Dance', 'Party', 'Open Floor', 'Tanzparty', 'Salsaparty', 'Bachata Party', 'Open Air', 'Tanzabend', 'Latin Night', 'Fiesta', 'Ball', 'Aftershow', 'Tanzveranstaltung', 'Salsa Veranstaltung', 'Bachata Veranstaltung', 'Kizomba Party', 'Zouk Party', 'Forró Party'
  ];
  const blacklist = [
    'Probestunde', 'Unterricht', 'Kurs', 'Workshop', 'Tanzkurs', 'Schnupperkurs', 'Lektion', 'Lehrgang', 'Training', 'Klasse', 'Schule', 'Tanzschule', 'Tanzunterricht', 'Tanzlehrer', 'Tanzlehrerin'
  ];
  const text = html.toLowerCase();
  const hasWhitelist = whitelist.some(term => text.includes(term.toLowerCase()));
  const hasBlacklist = blacklist.some(term => text.includes(term.toLowerCase()));
  return hasWhitelist && !hasBlacklist;
}

/**
 * Fetch HTML content from a URL with delay and custom user-agent, with content filtering.
 * @param {string} url - The URL to fetch
 * @returns {Promise<string|null>} - The HTML content or null if not relevant
 */
async function fetchEventPage(url) {
  await new Promise(res => setTimeout(res, 2000)); // 2s delay
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'TanzpartyBot/1.0 (+https://deineseite.de/bot-info)'
    },
    timeout: 10000
  });
  const html = response.data;
  if (!isRelevantEventPage(html)) return null;
  return html;
}

module.exports = { fetchEventPage }; 