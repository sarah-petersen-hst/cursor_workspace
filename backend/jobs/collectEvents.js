// collectEvents.js - Orchestrate collection of Salsa event metadata
// Legal/Ethical: Only process public, allowed, relevant pages

const { googleSearch } = require('../scrapers/googleSearch');
const { isAllowedByRobots } = require('../scrapers/robotsCheck');
const { fetchEventPage } = require('../scrapers/eventScraper');
const { extractEventMetadata } = require('../scrapers/geminiExtractor');
const { saveEventIfUnique } = require('../models/event');
const { isUrlRecentlyVisited, recordUrlVisit } = require('../models/visitedUrl');

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
    
    // Check if URL was recently visited
    const recentlyVisited = await isUrlRecentlyVisited(url);
    if (recentlyVisited) {
      console.log('Skipping - URL was recently visited');
      continue;
    }
    
    const allowed = await isAllowedByRobots(url);
    console.log(`robots.txt for ${url}:`, allowed);
    if (!allowed) {
      console.log('Skipping due to robots.txt restriction');
      await recordUrlVisit(url, false, 'robots.txt disallowed');
      continue;
    }
    
    const html = await fetchEventPage(url);
    if (!html) {
      console.log(`Content filtering failed for ${url}`);
      await recordUrlVisit(url, false, 'content filtering failed');
      continue;
    }
    
    console.log('Content filtering passed, proceeding to Gemini extraction...');
    const extractedEvents = await extractEventMetadata(html, url);
    console.log('Gemini extracted metadata:', extractedEvents);
    
    if (extractedEvents && Array.isArray(extractedEvents) && extractedEvents.length > 0) {
      console.log(`Found ${extractedEvents.length} valid events from ${url}`);
      let savedCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;
      
      for (const metadata of extractedEvents) {
        console.log(`Processing event: ${metadata.name}`);
        metadata.source_url = url;
        
        try {
          const saved = await saveEventIfUnique(metadata);
          console.log(`Event "${metadata.name}" saved:`, saved);
          if (saved) {
            events.push(metadata);
            savedCount++;
            console.log(`Successfully added event "${metadata.name}" to results`);
          } else {
            duplicateCount++;
            console.log(`Event "${metadata.name}" was duplicate, not saved`);
          }
        } catch (saveError) {
          errorCount++;
          console.error(`Error saving event "${metadata.name}" from ${url}:`, saveError);
        }
      }
      
      // Record URL visit based on overall success
      if (savedCount > 0) {
        await recordUrlVisit(url, true, `saved ${savedCount}/${extractedEvents.length} events`);
      } else if (duplicateCount > 0) {
        await recordUrlVisit(url, false, `all ${extractedEvents.length} events were duplicates`);
      } else {
        await recordUrlVisit(url, false, `failed to save any of ${extractedEvents.length} events`);
      }
      
      console.log(`URL processing complete: ${savedCount} saved, ${duplicateCount} duplicates, ${errorCount} errors`);
    } else {
      console.log(`No valid event metadata extracted from ${url}`);
      await recordUrlVisit(url, false, 'no valid event metadata extracted');
    }
  }
  
  console.log(`\n=== COLLECTION COMPLETE ===`);
  console.log(`Total events found: ${events.length}`);
  console.log(`URLs processed: ${processedCount}/${limitedUrls.length}`);
  
  return events;
}

module.exports = { collectEvents }; 