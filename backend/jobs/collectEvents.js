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
  console.log('\n=== STARTING EVENT COLLECTION ===');
  console.log('Running collectEvents for query:', query);
  
  const urls = await googleSearch(query);
  console.log('Google Search URLs:', urls);
  
  if (urls.length === 0) {
    console.log('No URLs found from Google search');
    return [];
  }
  
  // Limit to first 5 URLs for faster processing
  const limitedUrls = urls.slice(0, 5);
  console.log(`Processing ${limitedUrls.length} URLs (limited from ${urls.length} total)`);
  
  const events = [];
  let processedCount = 0;
  
  for (const url of limitedUrls) {
    processedCount++;
    console.log(`\n--- Processing URL ${processedCount}/${limitedUrls.length}: ${url} ---`);
    
    const allowed = await isAllowedByRobots(url);
    console.log(`robots.txt for ${url}:`, allowed);
    if (!allowed) {
      console.log('Skipping due to robots.txt restriction');
      continue;
    }
    
    const html = await fetchEventPage(url);
    if (!html) {
      console.log(`Content filtering failed for ${url}`);
      continue;
    }
    
    console.log('Content filtering passed, proceeding to Gemini extraction...');
    const metadata = await extractEventMetadata(html, url);
    console.log('Gemini extracted metadata:', metadata);
    
    if (metadata && metadata.name) {
      console.log(`Valid event found: ${metadata.name}`);
      metadata.source_url = url;
      
      try {
        const saved = await saveEventIfUnique(metadata);
        console.log(`Event saved for ${url}:`, saved);
        if (saved) {
          events.push(metadata);
          console.log(`Successfully added event to results`);
        }
      } catch (saveError) {
        console.error(`Error saving event from ${url}:`, saveError);
      }
    } else {
      console.log(`No valid event metadata extracted from ${url}`);
    }
  }
  
  console.log(`\n=== COLLECTION COMPLETE ===`);
  console.log(`Total events found: ${events.length}`);
  console.log(`URLs processed: ${processedCount}/${limitedUrls.length}`);
  
  return events;
}

module.exports = { collectEvents }; 