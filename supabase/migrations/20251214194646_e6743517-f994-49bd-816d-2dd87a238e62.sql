-- Create coordinator lock table for single-instance coordination
CREATE TABLE IF NOT EXISTS public.coordinator_lock (
  id TEXT PRIMARY KEY DEFAULT 'price-relay',
  instance_id TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '45 seconds'),
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_lock CHECK (id = 'price-relay')
);

-- Enable RLS (but allow service role full access)
ALTER TABLE public.coordinator_lock ENABLE ROW LEVEL SECURITY;

-- Create atomic lock acquisition function
CREATE OR REPLACE FUNCTION public.try_acquire_coordinator_lock(p_instance_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_acquired BOOLEAN := FALSE;
BEGIN
  -- Try to insert (first time) or update (if expired OR same instance) in one atomic operation
  INSERT INTO coordinator_lock (id, instance_id, locked_at, expires_at, heartbeat_at)
  VALUES ('price-relay', p_instance_id, now(), now() + interval '45 seconds', now())
  ON CONFLICT (id) DO UPDATE
  SET 
    instance_id = EXCLUDED.instance_id,
    locked_at = now(),
    expires_at = now() + interval '45 seconds',
    heartbeat_at = now()
  WHERE 
    coordinator_lock.instance_id = p_instance_id  -- Already the coordinator (renew)
    OR coordinator_lock.expires_at < now();        -- Previous lock expired (takeover)
  
  -- Check if we got the lock
  SELECT (instance_id = p_instance_id) INTO v_acquired
  FROM coordinator_lock 
  WHERE id = 'price-relay';
  
  RETURN COALESCE(v_acquired, FALSE);
END;
$$;

-- Create lock renewal function
CREATE OR REPLACE FUNCTION public.renew_coordinator_lock(p_instance_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE coordinator_lock
  SET 
    expires_at = now() + interval '45 seconds',
    heartbeat_at = now()
  WHERE id = 'price-relay' AND instance_id = p_instance_id;
  
  RETURN FOUND;
END;
$$;

-- Create function to release lock
CREATE OR REPLACE FUNCTION public.release_coordinator_lock(p_instance_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM coordinator_lock
  WHERE id = 'price-relay' AND instance_id = p_instance_id;
  
  RETURN FOUND;
END;
$$;