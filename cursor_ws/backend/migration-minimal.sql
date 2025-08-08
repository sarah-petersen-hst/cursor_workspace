-- Minimal migration script - only add recurrence_type and unique constraint

-- Step 1: Add recurrence_type column to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS recurrence_type VARCHAR(50);

-- Step 2: Add unique constraint to votes table (one vote per user per event)
-- First check if constraint already exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'votes_event_id_user_uuid_key' 
        AND table_name = 'votes'
    ) THEN
        ALTER TABLE public.votes ADD CONSTRAINT votes_event_id_user_uuid_key 
            UNIQUE (event_id, user_uuid);
    END IF;
END $$;

-- Migration complete - recurrence_type column added and ready for Gemini population 