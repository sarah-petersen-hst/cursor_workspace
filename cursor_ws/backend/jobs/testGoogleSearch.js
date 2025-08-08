// testGoogleSearch.js - Test Google Custom Search API integration
const { googleSearch } = require('../scrapers/googleSearch');

(async () => {
  const query = 'Salsa Veranstaltung Dienstag Berlin site:.de';
  const results = await googleSearch(query);
  console.log('Google Search Results:', results);
})();

// Run with: node jobs/testGoogleSearch.js 