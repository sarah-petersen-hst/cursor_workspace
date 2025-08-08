// index.js - Salsa Events Backend API
// Express server setup with CORS and dotenv

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, query, param, validationResult } = require('express-validator');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Enhanced CORS configuration - restrict to frontend origin only
const corsOptions = {
  origin: [FRONTEND_URL, 'http://localhost:3000'],
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  maxAge: 86400 // Cache preflight for 24 hours
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Limit payload size

// Rate limiting middleware
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const voteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 votes per minute
  message: { error: 'Too many votes, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 searches per minute
  message: { error: 'Too many search requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all requests
app.use(generalLimiter);

// Input validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Invalid input', 
      details: errors.array().map(err => ({ field: err.path, message: err.msg }))
    });
  }
  next();
};

// UUID validation helper
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

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
app.post('/api/vote', 
  voteLimiter,
  [
    body('eventId').isUUID().withMessage('Invalid event ID format'),
    body('userUuid').custom(value => {
      if (!isValidUUID(value)) {
        throw new Error('Invalid user UUID format');
      }
      return true;
    }),
    body('voteType').isIn(['exists', 'not_exists']).withMessage('Invalid vote type')
  ],
  handleValidationErrors,
  async (req, res) => {
  const { eventId, userUuid, voteType } = req.body;
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
app.delete('/api/vote',
  voteLimiter,
  [
    body('eventId').isUUID().withMessage('Invalid event ID format'),
    body('userUuid').custom(value => {
      if (!isValidUUID(value)) {
        throw new Error('Invalid user UUID format');
      }
      return true;
    })
  ],
  handleValidationErrors,
  async (req, res) => {
  const { eventId, userUuid } = req.body;
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
app.get('/api/votes/:eventId',
  [
    param('eventId').isUUID().withMessage('Invalid event ID format'),
    query('userUuid').optional().custom(value => {
      if (value && !isValidUUID(value)) {
        throw new Error('Invalid user UUID format');
      }
      return true;
    })
  ],
  handleValidationErrors,
  async (req, res) => {
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
app.post('/api/venue-vote',
  voteLimiter,
  [
    body('eventId').isUUID().withMessage('Invalid event ID format'),
    body('userUuid').custom(value => {
      if (!isValidUUID(value)) {
        throw new Error('Invalid user UUID format');
      }
      return true;
    }),
    body('voteType').isIn(['indoor', 'outdoor']).withMessage('Invalid venue vote type')
  ],
  handleValidationErrors,
  async (req, res) => {
  const { eventId, userUuid, voteType } = req.body;
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
app.get('/api/venue-votes/:eventId',
  [
    param('eventId').isUUID().withMessage('Invalid event ID format'),
    query('userUuid').optional().custom(value => {
      if (value && !isValidUUID(value)) {
        throw new Error('Invalid user UUID format');
      }
      return true;
    })
  ],
  handleValidationErrors,
  async (req, res) => {
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
app.delete('/api/venue-vote',
  voteLimiter,
  [
    body('eventId').isUUID().withMessage('Invalid event ID format'),
    body('userUuid').custom(value => {
      if (!isValidUUID(value)) {
        throw new Error('Invalid user UUID format');
      }
      return true;
    })
  ],
  handleValidationErrors,
  async (req, res) => {
  const { eventId, userUuid } = req.body;
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
app.post('/api/events/search',
  searchLimiter,
  [
    body('city').isString().isLength({ min: 1, max: 100 }).matches(/^[a-zA-ZäöüÄÖÜß \-]*$/).withMessage('Invalid city format'),
    body('date').isISO8601().withMessage('Invalid date format'),
    body('style').optional().isString().isLength({ max: 50 }).matches(/^[a-zA-Z \-]*$/).withMessage('Invalid style format'),
    body('styles').optional().isArray().withMessage('Styles must be an array')
  ],
  handleValidationErrors,
  async (req, res) => {
  const { city, date, style, styles } = req.body;

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
app.get('/api/cities',
  searchLimiter,
  [
    query('query')
      .isString()
      .isLength({ min: 1, max: 50 })
      .matches(/^[a-zA-ZäöüÄÖÜß \-]*$/)
      .withMessage('Query must contain only letters, spaces, hyphens, and German umlauts')
  ],
  handleValidationErrors,
  (req, res) => {
  const { query } = req.query;
  
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