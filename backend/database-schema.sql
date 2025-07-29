-- Database schema for Salsa Dance Events Finder
-- Run this script to create the required tables

-- Events table for storing salsa dance events
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,           -- Event name (REQUIRED)
    date DATE NOT NULL,                   -- Event date (REQUIRED)
    address TEXT NOT NULL,                -- Venue address - can be just city name (REQUIRED)
    source_url TEXT NOT NULL UNIQUE,     -- Source URL/link (REQUIRED, unique to prevent duplicates)
    styles JSONB,                         -- Array of dance styles like ['Salsa', 'Bachata'] (OPTIONAL)
    workshops JSONB,                      -- Array of workshop objects (OPTIONAL)
    party JSONB,                         -- Party details object (OPTIONAL)
    recurrence VARCHAR(100),             -- Recurrence pattern like 'wöchentlich' (OPTIONAL)
    venue_type VARCHAR(50),              -- 'Indoor', 'Outdoor', or 'Not specified' (OPTIONAL)
    processed_at TIMESTAMP DEFAULT NOW(), -- When this event was processed
    created_at TIMESTAMP DEFAULT NOW()    -- When this record was created
);

-- Visited URLs table to track all scraped URLs (successful or failed)
CREATE TABLE IF NOT EXISTS visited_urls (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,            -- The URL that was visited
    visited_at TIMESTAMP DEFAULT NOW(),  -- When this URL was last visited
    extraction_success BOOLEAN DEFAULT FALSE, -- Whether event extraction was successful
    failure_reason TEXT,                 -- Reason for failure (if any)
    created_at TIMESTAMP DEFAULT NOW()   -- When this record was created
);

-- Index for faster lookups by URL and date
CREATE INDEX IF NOT EXISTS idx_visited_urls_url ON visited_urls(url);
CREATE INDEX IF NOT EXISTS idx_visited_urls_visited_at ON visited_urls(visited_at);

-- Votes table for event existence voting
CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    user_uuid VARCHAR(36) NOT NULL,      -- UUID stored in browser localStorage
    vote_type VARCHAR(20) NOT NULL,      -- 'exists' or 'doesnt_exist'
    vote_time TIMESTAMP DEFAULT NOW(),   -- When the vote was cast
    UNIQUE(event_id, user_uuid)          -- One vote per user per event
);

-- Venue votes table for indoor/outdoor voting
CREATE TABLE IF NOT EXISTS venue_votes (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    user_uuid VARCHAR(36) NOT NULL,      -- UUID stored in browser localStorage  
    vote_type VARCHAR(20) NOT NULL,      -- 'indoor' or 'outdoor'
    vote_time TIMESTAMP DEFAULT NOW(),   -- When the vote was cast
    UNIQUE(event_id, user_uuid)          -- One vote per user per event
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_address ON events(address);
CREATE INDEX IF NOT EXISTS idx_events_source_url ON events(source_url);
CREATE INDEX IF NOT EXISTS idx_votes_event_id ON votes(event_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_uuid ON votes(user_uuid);
CREATE INDEX IF NOT EXISTS idx_venue_votes_event_id ON venue_votes(event_id);
CREATE INDEX IF NOT EXISTS idx_venue_votes_user_uuid ON venue_votes(user_uuid); 