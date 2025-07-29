-- Database schema for Salsa Dance Events Finder
-- Run this script to create the required tables

-- Events table for storing salsa dance events
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    styles JSONB,                          -- Array of dance styles like ['Salsa', 'Bachata']
    date DATE,                             -- Event date
    workshops JSONB,                       -- Array of workshop objects
    party JSONB,                          -- Party details object
    address TEXT,                         -- Full venue address
    source_url TEXT UNIQUE,               -- Source URL (unique to prevent duplicates)
    recurrence VARCHAR(100),              -- Recurrence pattern like 'wöchentlich'
    venue_type VARCHAR(50),               -- 'Indoor', 'Outdoor', or 'Not specified'
    processed_at TIMESTAMP DEFAULT NOW(), -- When this event was processed
    created_at TIMESTAMP DEFAULT NOW()    -- When this record was created
);

-- Votes table for event existence voting
CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(50) NOT NULL,
    user_uuid UUID NOT NULL,
    vote_type VARCHAR(20) NOT NULL CHECK (vote_type IN ('exists', 'not_exists')),
    vote_time TIMESTAMP DEFAULT NOW(),
    UNIQUE(event_id, user_uuid, date_trunc('week', vote_time))
);

-- Venue votes table for indoor/outdoor voting
CREATE TABLE IF NOT EXISTS venue_votes (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(50) NOT NULL,
    user_uuid UUID NOT NULL,
    vote_type VARCHAR(20) NOT NULL CHECK (vote_type IN ('indoor', 'outdoor')),
    vote_time TIMESTAMP DEFAULT NOW(),
    UNIQUE(event_id, user_uuid) -- Only one vote per user per event (no weekly reset)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_address ON events(address);
CREATE INDEX IF NOT EXISTS idx_events_source_url ON events(source_url);
CREATE INDEX IF NOT EXISTS idx_votes_event_id ON votes(event_id);
CREATE INDEX IF NOT EXISTS idx_venue_votes_event_id ON venue_votes(event_id); 