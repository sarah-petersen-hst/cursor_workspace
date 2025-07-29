// event.js - Event model for PostgreSQL storage and deduplication
const pool = require('../db');

/**
 * Transform database event to frontend format
 * @param {object} dbEvent - Raw database event
 * @returns {object} - Frontend-compatible event
 */
function transformEventForFrontend(dbEvent) {
  return {
    id: dbEvent.id.toString(), // Convert number to string
    name: dbEvent.name,
    date: dbEvent.date ? new Date(dbEvent.date).toISOString().split('T')[0] : '', // Convert ISO to YYYY-MM-DD
    address: dbEvent.address || '',
    source: dbEvent.source_url || '', // source_url → source
    trusted: isEventTrusted(dbEvent.source_url), // Determine if source is trusted
    recurrence: dbEvent.recurrence || null,
    venueType: dbEvent.venue_type || 'Not specified', // venue_type → venueType
    // Add event details if they exist
    workshops: Array.isArray(dbEvent.workshops) ? transformWorkshops(dbEvent.workshops) : [],
    party: dbEvent.party && typeof dbEvent.party === 'object' ? transformParty(dbEvent.party) : null
  };
}

/**
 * Determine if an event source is trusted based on URL
 * @param {string} sourceUrl 
 * @returns {boolean}
 */
function isEventTrusted(sourceUrl) {
  if (!sourceUrl) return false;
  
  // Define trusted domains
  const trustedDomains = [
    'salsaberlin.de',
    'salsa-und-tango.de',
    'salsalemania.de',
    'tanzschule.de',
    'eventbrite.de'
  ];
  
  try {
    const url = new URL(sourceUrl);
    return trustedDomains.some(domain => url.hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Transform database workshops to frontend format
 * @param {array} workshops 
 * @returns {array}
 */
function transformWorkshops(workshops) {
  if (!Array.isArray(workshops)) return [];
  
  return workshops.map(ws => ({
    start: ws.startTime || ws.start || '',
    end: ws.endTime || ws.end || '',
    style: ws.style || '',
    level: ws.level || 'Open Level'
  }));
}

/**
 * Transform database party to frontend format
 * @param {object} party 
 * @returns {object}
 */
function transformParty(party) {
  if (!party || typeof party !== 'object') return null;
  
  return {
    start: party.startTime || party.start || '',
    end: party.endTime || party.end || undefined,
    floors: Array.isArray(party.floors) ? party.floors.map(floor => ({
      floor: floor.floor || floor.name || 'Main Floor',
      distribution: floor.distribution || floor.music || ''
    })) : []
  };
}

/**
 * Check if a URL has been processed in the last 3 days.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function isUrlRecent(url) {
  const result = await pool.query(
    `SELECT 1 FROM events WHERE source_url = $1 AND processed_at > NOW() - INTERVAL '3 days' LIMIT 1`,
    [url]
  );
  return result.rows.length > 0;
}

/**
 * Check if an event at the same location and date already exists.
 * @param {string} address
 * @param {string} date
 * @returns {Promise<boolean>}
 */
async function isDuplicateEvent(address, date) {
  const result = await pool.query(
    `SELECT 1 FROM events WHERE address = $1 AND date = $2 LIMIT 1`,
    [address, date]
  );
  return result.rows.length > 0;
}

/**
 * Save an event if it is unique (not duplicate by URL or location/date).
 * @param {object} event
 * @returns {Promise<boolean>} - True if saved, false if duplicate
 */
async function saveEventIfUnique(event) {
  if (await isUrlRecent(event.source_url)) return false;
  if (await isDuplicateEvent(event.address, event.date)) return false;
  await pool.query(
    `INSERT INTO events (name, styles, date, workshops, party, address, source_url, recurrence, venue_type, processed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
    [event.name, event.styles, event.date, event.workshops, event.party, event.address, event.source_url, event.recurrence, event.venue_type]
  );
  return true;
}

/**
 * Query the database for events matching city, date, and style.
 * @param {string} city
 * @param {string} date
 * @param {string} style
 * @returns {Promise<object[]>} - Frontend-compatible events
 */
async function findEvents(city, date, style) {
  let query = `SELECT * FROM events WHERE 1=1`;
  const params = [];
  if (city) {
    query += ` AND LOWER(address) LIKE $${params.length + 1}`;
    params.push(`%${city.toLowerCase()}%`);
  }
  if (date) {
    query += ` AND date = $${params.length + 1}`;
    params.push(date);
  }
  if (style) {
    query += ` AND styles ILIKE $${params.length + 1}`;
    params.push(`%${style}%`);
  }
  query += ` ORDER BY date ASC, name ASC`;
  const result = await pool.query(query, params);
  
  // Transform all events to frontend format
  return result.rows.map(transformEventForFrontend);
}

module.exports = { isUrlRecent, isDuplicateEvent, saveEventIfUnique, findEvents }; 