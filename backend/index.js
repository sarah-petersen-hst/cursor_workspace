// index.js - Salsa Events Backend API
// Express server setup with CORS and dotenv

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const pool = require('./db');
const { v4: uuidv4 } = require('uuid');
const { getVisitedUrlStats, cleanupOldVisitedUrls, URL_REVISIT_COOLDOWN_DAYS } = require('./models/visitedUrl');
const { collectEvents } = require('./jobs/collectEvents');
const { findEvents } = require('./models/event');

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * POST /api/vote
 * Body: { eventId: string, userUuid: string, voteType: 'exists' | 'not_exists' }
 * Enforces one vote per user per event per week.
 */
app.post('/api/vote', async (req, res) => {
  const { eventId, userUuid, voteType } = req.body;
  if (!eventId || !userUuid || !['exists', 'not_exists'].includes(voteType)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  try {
    // Upsert: Try to insert, if conflict on unique index, update the vote_type and vote_time
    const result = await pool.query(
      `INSERT INTO votes (event_id, user_uuid, vote_type, vote_time)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (event_id, user_uuid, date_trunc('week', vote_time))
       DO UPDATE SET vote_type = EXCLUDED.vote_type, vote_time = NOW()
       RETURNING *;`,
      [eventId, userUuid, voteType]
    );
    res.json({ success: true, vote: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * DELETE /api/vote
 * Body: { eventId: string, userUuid: string }
 * Deletes the user's vote for the event for the current week.
 */
app.delete('/api/vote', async (req, res) => {
  const { eventId, userUuid } = req.body;
  if (!eventId || !userUuid) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  try {
    await pool.query(
      `DELETE FROM votes
       WHERE event_id = $1 AND user_uuid = $2
       AND date_trunc('week', vote_time) = date_trunc('week', NOW())`,
      [eventId, userUuid]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * GET /api/votes/:eventId?userUuid=...
 * Returns vote counts for the current and previous week for the given event.
 * If userUuid is provided, also returns the user's vote for the current week.
 */
app.get('/api/votes/:eventId', async (req, res) => {
  const { eventId } = req.params;
  const { userUuid } = req.query;
  try {
    // Get current week and previous week vote counts
    const result = await pool.query(
      `SELECT
         date_trunc('week', vote_time) AS week,
         vote_type,
         COUNT(*) AS count
       FROM votes
       WHERE event_id = $1
       GROUP BY week, vote_type
       ORDER BY week DESC;`,
      [eventId]
    );
    // Format as { week: { exists: n, not_exists: n } }
    const weekVotes = {};
    for (const row of result.rows) {
      const week = row.week.toISOString().slice(0, 10);
      if (!weekVotes[week]) weekVotes[week] = { exists: 0, not_exists: 0 };
      weekVotes[week][row.vote_type] = parseInt(row.count, 10);
    }
    let userVote = null;
    if (userUuid) {
      // Get the user's vote for the current week
      const userResult = await pool.query(
        `SELECT vote_type FROM votes
         WHERE event_id = $1 AND user_uuid = $2
         AND date_trunc('week', vote_time) = date_trunc('week', NOW())
         LIMIT 1;`,
        [eventId, userUuid]
      );
      if (userResult.rows.length > 0) {
        userVote = userResult.rows[0].vote_type;
      }
    }
    res.json({ eventId, weekVotes, userVote });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * Venue voting table: event_id, user_uuid, vote_type ('indoor' | 'outdoor'), vote_time
 * POST /api/venue-vote: { eventId, userUuid, voteType }
 * GET /api/venue-votes/:eventId: returns counts and user vote
 * DELETE /api/venue-vote: { eventId, userUuid }
 */

// POST venue vote (upsert)
app.post('/api/venue-vote', async (req, res) => {
  const { eventId, userUuid, voteType } = req.body;
  if (!eventId || !userUuid || !['indoor', 'outdoor'].includes(voteType)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO venue_votes (event_id, user_uuid, vote_type, vote_time)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (event_id, user_uuid)
       DO UPDATE SET vote_type = EXCLUDED.vote_type, vote_time = NOW()
       RETURNING *;`,
      [eventId, userUuid, voteType]
    );
    res.json({ success: true, vote: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// GET venue votes for an event
app.get('/api/venue-votes/:eventId', async (req, res) => {
  const { eventId } = req.params;
  const { userUuid } = req.query;
  try {
    const result = await pool.query(
      `SELECT vote_type, COUNT(*) AS count
       FROM venue_votes
       WHERE event_id = $1
       GROUP BY vote_type;`,
      [eventId]
    );
    const counts = { indoor: 0, outdoor: 0 };
    for (const row of result.rows) {
      counts[row.vote_type] = parseInt(row.count, 10);
    }
    let userVote = null;
    if (userUuid) {
      const userResult = await pool.query(
        `SELECT vote_type FROM venue_votes WHERE event_id = $1 AND user_uuid = $2 LIMIT 1;`,
        [eventId, userUuid]
      );
      if (userResult.rows.length > 0) {
        userVote = userResult.rows[0].vote_type;
      }
    }
    res.json({ eventId, counts, userVote });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE venue vote
app.delete('/api/venue-vote', async (req, res) => {
  const { eventId, userUuid } = req.body;
  if (!eventId || !userUuid) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  try {
    await pool.query(
      `DELETE FROM venue_votes WHERE event_id = $1 AND user_uuid = $2`,
      [eventId, userUuid]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * POST /api/events/search
 * Body: { city, date, style }
 * Triggers event collection and returns found events.
 */
app.post('/api/events/search', async (req, res) => {
  const { city, date, style, styles } = req.body;
  if (!city || !date) {
    return res.status(400).json({ error: 'City and date are required' });
  }

  // Set a timeout for the entire operation
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Search timeout - taking too long')), 30000); // 30 second timeout
  });

  try {
    console.log(`Starting search for: ${city}, ${date}, ${style}`);
    
    // Build Google query - include dance style for better targeting but still scrape all dance events
    const weekday = new Date(date).toLocaleDateString('de-DE', { weekday: 'long' });
    let query = `Salsa Veranstaltung ${weekday} ${city} site:.de`;
    
    // Add dance style to query if provided (for better Google targeting)
    if (style) {
      query = `${style} Veranstaltung ${weekday} ${city} site:.de`;
      console.log(`Including dance style "${style}" in Google search query`);
    }
    
    console.log(`Google search query: ${query}`);
    
    // Run the scraping with timeout protection
    const searchPromise = collectEvents(query);
    
    await Promise.race([searchPromise, timeoutPromise]);
    console.log('Event collection completed, querying database...');
    
    // Query the DB for all relevant events (existing + new) - don't filter by style in DB
    const events = await findEvents(city, date, ''); // Empty style to get all events
    console.log(`Found ${events.length} events in database`);
    
    res.json({ events, requestedStyles: styles || [] });
  } catch (err) {
    console.error('Error in /api/events/search:', err);
    if (err && err.stack) console.error(err.stack);
    
    // If it's a timeout, still try to return existing events from DB
    if (err.message.includes('timeout')) {
      console.log('Search timed out, returning existing events from database...');
      try {
        const events = await findEvents(city, date, ''); // Empty style to get all events
        res.json({ 
          events, 
          requestedStyles: styles || [],
          warning: 'Search timed out, showing existing events. New events may be added in background.' 
        });
        return;
      } catch (dbErr) {
        console.error('Database query also failed:', dbErr);
      }
    }
    
    res.status(500).json({ error: 'Failed to collect events', details: err.message || err });
  }
});

// German cities list for autocomplete
const GERMAN_CITIES = [
  'Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt am Main', 'Stuttgart', 
  'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig', 'Bremen', 'Dresden', 
  'Hannover', 'Nürnberg', 'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld',
  'Bonn', 'Münster', 'Karlsruhe', 'Mannheim', 'Augsburg', 'Wiesbaden',
  'Gelsenkirchen', 'Mönchengladbach', 'Braunschweig', 'Chemnitz', 'Kiel',
  'Aachen', 'Halle', 'Magdeburg', 'Freiburg', 'Krefeld', 'Lübeck',
  'Oberhausen', 'Erfurt', 'Mainz', 'Rostock', 'Kassel', 'Hagen', 'Potsdam'
];

/**
 * GET /api/cities?query=...
 * Returns a list of city names matching the query. Safe from SQL injection.
 */
app.get('/api/cities', (req, res) => {
  const { query } = req.query;
  if (typeof query !== 'string' || query.length > 100) {
    return res.status(400).json({ error: 'Invalid city query' });
  }
  // Only allow letters, spaces, hyphens, and German umlauts
  if (!/^[a-zA-ZäöüÄÖÜß \-]*$/.test(query)) {
    return res.status(400).json({ error: 'Invalid characters in city query' });
  }
  
  // Filter cities based on query
  const filteredCities = GERMAN_CITIES.filter(city => 
    city.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10);
  
  res.json(filteredCities);
});

// GET visited URL statistics
app.get('/api/visited-urls/stats', async (req, res) => {
  try {
    const stats = await getVisitedUrlStats();
    res.json({
      ...stats,
      cooldown_days: URL_REVISIT_COOLDOWN_DAYS
    });
  } catch (error) {
    console.error('Error getting visited URL stats:', error);
    res.status(500).json({ error: 'Failed to get visited URL statistics' });
  }
});

// POST cleanup old visited URLs
app.post('/api/visited-urls/cleanup', async (req, res) => {
  try {
    const deletedCount = await cleanupOldVisitedUrls();
    res.json({
      message: 'Cleanup completed',
      deleted_urls: deletedCount,
      cooldown_days: URL_REVISIT_COOLDOWN_DAYS
    });
  } catch (error) {
    console.error('Error cleaning up visited URLs:', error);
    res.status(500).json({ error: 'Failed to cleanup visited URLs' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend API listening on port ${PORT}`);
  console.log(`URL revisit cooldown: ${URL_REVISIT_COOLDOWN_DAYS} days`);
}); 