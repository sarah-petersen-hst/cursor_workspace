-- Migration script to make required fields NOT NULL
-- Run this BEFORE updating the schema to prevent constraint violations

-- Step 1: Fill any NULL values in required columns with placeholder data
UPDATE events 
SET name = 'Event Name Missing' 
WHERE name IS NULL OR name = '';

UPDATE events 
SET date = CURRENT_DATE 
WHERE date IS NULL;

UPDATE events 
SET address = 'Address Missing' 
WHERE address IS NULL OR address = '';

UPDATE events 
SET source_url = 'https://example.com/missing-' || id 
WHERE source_url IS NULL OR source_url = '';

-- Step 2: Add NOT NULL constraints to required fields
ALTER TABLE events ALTER COLUMN name SET NOT NULL;
ALTER TABLE events ALTER COLUMN date SET NOT NULL;
ALTER TABLE events ALTER COLUMN address SET NOT NULL;
ALTER TABLE events ALTER COLUMN source_url SET NOT NULL;

-- Step 3: Ensure source_url remains unique
-- (This should already exist, but ensure it's there)
-- ALTER TABLE events ADD CONSTRAINT events_source_url_unique UNIQUE (source_url); 