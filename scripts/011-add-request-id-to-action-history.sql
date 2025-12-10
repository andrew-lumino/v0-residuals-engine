-- Migration: Add request_id to action_history table
-- Purpose: Enable correlation between action_history and debug_logs for error tracing
-- Date: 2025-11-26

-- Add request_id column to action_history
ALTER TABLE action_history 
ADD COLUMN IF NOT EXISTS request_id text;

-- Create index for efficient lookups by request_id
CREATE INDEX IF NOT EXISTS idx_action_history_request_id 
ON action_history(request_id) 
WHERE request_id IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN action_history.request_id IS 
'Correlates with debug_logs.request_id to trace actions and errors from the same request';
