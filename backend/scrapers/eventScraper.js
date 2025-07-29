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
    'social dance', 'party', 'open floor', 'tanzparty', 'salsaparty', 'bachata party', 
    'open air', 'tanzabend', 'latin night', 'fiesta', 'ball', 'aftershow', 
    'tanzveranstaltung', 'salsa veranstaltung', 'bachata veranstaltung', 
    'kizomba party', 'zouk party', 'forró party', 'salsa', 'bachata', 'kizomba',
    'veranstaltung', 'event', 'tanz', 'dancing', 'milonga', 'social'
  ];
  
  // Only blacklist if it's ONLY about courses with no party/event content
  const blacklist = [
    'nur unterricht', 'ausschließlich kurs', 'reine tanzschule', 'nur probestunde'
  ];
  
  const text = html.toLowerCase();
  const hasWhitelist = whitelist.some(term => text.includes(term.toLowerCase()));
  const hasBlacklist = blacklist.some(term => text.includes(term.toLowerCase()));
  
  console.log(`Content filtering for URL:
    - Has whitelist terms: ${hasWhitelist}
    - Has blacklist terms: ${hasBlacklist}
    - Result: ${hasWhitelist && !hasBlacklist}`);
  
  return hasWhitelist && !hasBlacklist;
}

/**
 * Fetch HTML content from a URL with delay and custom user-agent, with content filtering.
 * @param {string} url - The URL to fetch
 * @returns {Promise<string|null>} - The HTML content or null if not relevant
 */
async function fetchEventPage(url) {
  try {
    console.log(`Fetching HTML content from: ${url}`);
    await new Promise(res => setTimeout(res, 2000)); // 2s delay
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'TanzpartyBot/1.0 (+https://deineseite.de/bot-info)'
      },
      timeout: 10000
    });
    
    const html = response.data;
    console.log(`Fetched ${html.length} characters of HTML content`);
    
    if (!isRelevantEventPage(html)) {
      console.log(`Content filtering failed for ${url}`);
      return null;
    }
    
    console.log(`Content filtering passed for ${url}`);
    return html;
    
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return null;
  }
}

module.exports = { fetchEventPage }; 