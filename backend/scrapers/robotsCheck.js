// robotsCheck.js - robots.txt compliance checker
// Legal/Ethical: Always check robots.txt before scraping any URL

const robotsParser = require('robots-txt-parse');
const url = require('url');

/**
 * Check if a given URL is allowed for TanzpartyBot/1.0 according to robots.txt
 * @param {string} targetUrl - The URL to check
 * @returns {Promise<boolean>} - True if allowed, false if disallowed
 */
async function isAllowedByRobots(targetUrl) {
  const parsed = url.parse(targetUrl);
  const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;
  try {
    const robots = await robotsParser(robotsUrl);
    return robots.isAllowed(targetUrl, 'TanzpartyBot/1.0');
  } catch (err) {
    // If robots.txt cannot be fetched, default to disallow
    return false;
  }
}

module.exports = { isAllowedByRobots }; 