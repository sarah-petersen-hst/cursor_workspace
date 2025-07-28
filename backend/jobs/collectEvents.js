// collectEvents.js - Orchestrate collection of Salsa event metadata
// Legal/Ethical: Only process public, allowed, relevant pages

const { googleSearch } = require('../scrapers/googleSearch');
const { isAllowedByRobots } = require('../scrapers/robotsCheck');
const { fetchEventPage } = require('../scrapers/eventScraper');
const { extractEventMetadata } = require('../scrapers/geminiExtractor');
const { saveEventIfUnique } = require('../models/event');

/**
 * Orchestrate the collection of Salsa event metadata for a given query.
 * @param {string} query - The Google search query
 * @returns {Promise<object[]>} - Array of extracted event metadata
 */
async function collectEvents(query) {
  const urls = await googleSearch(query);
  const events = [];
  for (const url of urls) {
    const allowed = await isAllowedByRobots(url);
    if (!allowed) continue;
    const html = await fetchEventPage(url);
    if (!html) continue;
    const metadata = await extractEventMetadata(html, url);
    if (metadata && metadata.name) {
      metadata.source_url = url;
      const saved = await saveEventIfUnique(metadata);
      if (saved) events.push(metadata);
    }
  }
  return events;
}

module.exports = { collectEvents }; 