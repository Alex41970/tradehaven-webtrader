-- Add action_details column to admin_audit_log for more granular tracking
ALTER TABLE admin_audit_log 
ADD COLUMN IF NOT EXISTS action_details jsonb DEFAULT '{}'::jsonb;

-- Create indexes for faster audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_log_action 
ON admin_audit_log(action);

CREATE INDEX IF NOT EXISTS idx_audit_log_performed_at 
ON admin_audit_log(performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin_id 
ON admin_audit_log(admin_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id 
ON admin_audit_log(user_id);

-- Add comment for documentation
COMMENT ON COLUMN admin_audit_log.action_details IS 'Additional metadata about the action performed';
