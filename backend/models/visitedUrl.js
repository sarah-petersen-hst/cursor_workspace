const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'salsa_events',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

// Configurable timeframe for URL revisit prevention (in days)
const URL_REVISIT_COOLDOWN_DAYS = process.env.URL_REVISIT_COOLDOWN_DAYS || 3;

/**
 * Check if a URL has been visited recently (within the cooldown period)
 * @param {string} url - The URL to check
 * @returns {Promise<boolean>} - True if URL was visited recently, false otherwise
 */
async function isUrlRecentlyVisited(url) {
  try {
    const result = await pool.query(
      `SELECT id FROM visited_urls 
       WHERE url = $1 AND visited_at > NOW() - INTERVAL '${URL_REVISIT_COOLDOWN_DAYS} days'
       LIMIT 1`,
      [url]
    );
    
    const wasRecentlyVisited = result.rows.length > 0;
    if (wasRecentlyVisited) {
      console.log(`🚫 URL recently visited (within ${URL_REVISIT_COOLDOWN_DAYS} days): ${url}`);
    }
    
    return wasRecentlyVisited;
  } catch (error) {
    console.error('Error checking if URL was recently visited:', error);
    return false; // If there's an error, allow the URL to be processed
  }
}

/**
 * Record a URL visit (successful or failed)
 * @param {string} url - The URL that was visited
 * @param {boolean} extractionSuccess - Whether event extraction was successful
 * @param {string} failureReason - Reason for failure (if any)
 * @returns {Promise<boolean>} - True if recorded successfully
 */
async function recordUrlVisit(url, extractionSuccess = false, failureReason = null) {
  try {
    await pool.query(
      `INSERT INTO visited_urls (url, visited_at, extraction_success, failure_reason)
       VALUES ($1, NOW(), $2, $3)
       ON CONFLICT (url) 
       DO UPDATE SET 
         visited_at = NOW(),
         extraction_success = $2,
         failure_reason = $3`,
      [url, extractionSuccess, failureReason]
    );
    
    console.log(`📝 Recorded URL visit: ${url} (success: ${extractionSuccess})`);
    if (failureReason) {
      console.log(`   Failure reason: ${failureReason}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error recording URL visit:', error);
    return false;
  }
}

/**
 * Clean up old visited URLs (older than the cooldown period)
 * This can be called periodically to prevent the table from growing too large
 * @returns {Promise<number>} - Number of URLs cleaned up
 */
async function cleanupOldVisitedUrls() {
  try {
    const result = await pool.query(
      `DELETE FROM visited_urls 
       WHERE visited_at < NOW() - INTERVAL '${URL_REVISIT_COOLDOWN_DAYS * 2} days'`
    );
    
    const deletedCount = result.rowCount || 0;
    if (deletedCount > 0) {
      console.log(`🧹 Cleaned up ${deletedCount} old visited URLs`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up old visited URLs:', error);
    return 0;
  }
}

/**
 * Get statistics about visited URLs
 * @returns {Promise<object>} - Statistics object
 */
async function getVisitedUrlStats() {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_urls,
        COUNT(*) FILTER (WHERE extraction_success = true) as successful_extractions,
        COUNT(*) FILTER (WHERE extraction_success = false) as failed_extractions,
        COUNT(*) FILTER (WHERE visited_at > NOW() - INTERVAL '${URL_REVISIT_COOLDOWN_DAYS} days') as recent_visits
      FROM visited_urls
    `);
    
    return result.rows[0] || {
      total_urls: 0,
      successful_extractions: 0,
      failed_extractions: 0,
      recent_visits: 0
    };
  } catch (error) {
    console.error('Error getting visited URL stats:', error);
    return {
      total_urls: 0,
      successful_extractions: 0,
      failed_extractions: 0,
      recent_visits: 0
    };
  }
}

module.exports = {
  isUrlRecentlyVisited,
  recordUrlVisit,
  cleanupOldVisitedUrls,
  getVisitedUrlStats,
  URL_REVISIT_COOLDOWN_DAYS
}; 