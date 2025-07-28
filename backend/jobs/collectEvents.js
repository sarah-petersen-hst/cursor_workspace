// collectEvents.js - Orchestrate collection of Salsa event metadata
// Legal/Ethical: Only process public, allowed, relevant pages

const { googleSearch } = require('../scrapers/googleSearch');
const { isAllowedByRobots } = require('../scrapers/robotsCheck');
const { fetchEventPage } = require('../scrapers/eventScraper');
const { extractEventMetadata } = require('../scrapers/geminiExtractor');
// const { saveEventIfUnique } = require('../models/event');

/**
 * Orchestrate the collection of Salsa event metadata for a given query.
 * @param {string} query - The Google search query
 * @returns {Promise<void>}
 */
async function collectEvents(query) {
  // 1. Google Search
  const urls = await googleSearch(query);
  for (const url of urls) {
    // 2. robots.txt check
    const allowed = await isAllowedByRobots(url);
    if (!allowed) continue;
    // 3. Scrape event page
    const html = await fetchEventPage(url);
    // 4. Content filtering (TODO: whitelist/blacklist terms)
    // 5. LLM extraction
    const metadata = await extractEventMetadata(html, url);
    // 6. Deduplication and storage (TODO)
    // await saveEventIfUnique(metadata);
  }
}

module.exports = { collectEvents }; 