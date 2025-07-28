// event.js - Event model for PostgreSQL storage and deduplication
const pool = require('../db');

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
 * @returns {Promise<object[]>}
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
  return result.rows;
}

module.exports = { isUrlRecent, isDuplicateEvent, saveEventIfUnique, findEvents }; 