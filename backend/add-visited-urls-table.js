const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'salsa_events',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function addVisitedUrlsTable() {
  try {
    console.log('🔄 Adding visited_urls table...');
    
    await pool.query(`
      -- Visited URLs table to track all scraped URLs (successful or failed)
      CREATE TABLE IF NOT EXISTS visited_urls (
          id SERIAL PRIMARY KEY,
          url TEXT NOT NULL UNIQUE,            -- The URL that was visited
          visited_at TIMESTAMP DEFAULT NOW(),  -- When this URL was last visited
          extraction_success BOOLEAN DEFAULT FALSE, -- Whether event extraction was successful
          failure_reason TEXT,                 -- Reason for failure (if any)
          created_at TIMESTAMP DEFAULT NOW()   -- When this record was created
      );
    `);
    
    await pool.query(`
      -- Index for faster lookups by URL and date
      CREATE INDEX IF NOT EXISTS idx_visited_urls_url ON visited_urls(url);
      CREATE INDEX IF NOT EXISTS idx_visited_urls_visited_at ON visited_urls(visited_at);
    `);
    
    console.log('✅ visited_urls table created successfully');
    
    // Check if table exists and show structure
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'visited_urls' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📊 Table structure:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
  } catch (error) {
    console.error('❌ Error adding visited_urls table:', error.message);
  } finally {
    await pool.end();
  }
}

addVisitedUrlsTable(); 