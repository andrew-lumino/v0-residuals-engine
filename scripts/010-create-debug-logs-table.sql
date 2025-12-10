-- Debug Logs Table
-- Stores application logs, errors, and system events

CREATE TABLE IF NOT EXISTS debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Log classification
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
  source TEXT NOT NULL, -- 'api', 'sync', 'import', 'client', 'cron', etc.
  
  -- Log content
  message TEXT NOT NULL,
  metadata JSONB, -- Additional context (stack trace, request data, etc.)
  
  -- Optional associations
  user_id UUID,
  entity_type TEXT,
  entity_id TEXT,
  
  -- Request context
  request_id UUID, -- For correlating logs from same request
  endpoint TEXT, -- API endpoint that generated the log
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_debug_logs_level ON debug_logs(level);
CREATE INDEX IF NOT EXISTS idx_debug_logs_source ON debug_logs(source);
CREATE INDEX IF NOT EXISTS idx_debug_logs_created_at ON debug_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debug_logs_request ON debug_logs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_debug_logs_errors ON debug_logs(created_at DESC) WHERE level IN ('error', 'fatal');

-- Enable RLS
ALTER TABLE debug_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for now
CREATE POLICY "Allow all access to debug_logs" ON debug_logs
  FOR ALL USING (true) WITH CHECK (true);

-- Auto-cleanup: Create function to delete old logs (optional, run manually or via cron)
CREATE OR REPLACE FUNCTION cleanup_old_debug_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM debug_logs 
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL
    AND level NOT IN ('error', 'fatal'); -- Keep errors longer
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE debug_logs IS 'Application logs and error tracking';
COMMENT ON FUNCTION cleanup_old_debug_logs IS 'Deletes debug/info/warn logs older than specified days (keeps errors)';
