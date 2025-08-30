-- Comprehensive Backend Health Check System

-- Create a comprehensive health check function
CREATE OR REPLACE FUNCTION public.run_system_health_check()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  health_report JSON;
  user_count INTEGER;
  total_issues INTEGER := 0;
  margin_issues INTEGER := 0;
  balance_issues INTEGER := 0;
  orphaned_trades INTEGER := 0;
  invalid_orders INTEGER := 0;
  issues_array JSON[] := ARRAY[]::JSON[];
  user_record RECORD;
  trade_record RECORD;
BEGIN
  RAISE NOTICE 'Starting comprehensive system health check...';
  
  -- Count total users
  SELECT COUNT(*) INTO user_count FROM user_profiles;
  
  -- Check for margin consistency issues
  FOR user_record IN 
    SELECT 
      up.user_id,
      up.balance,
      up.used_margin,
      up.available_margin,
      COALESCE(SUM(t.margin_used), 0) as calculated_used_margin,
      COALESCE(SUM(CASE WHEN t.status = 'closed' THEN t.pnl ELSE 0 END), 0) as total_closed_pnl
    FROM user_profiles up
    LEFT JOIN trades t ON up.user_id = t.user_id AND t.status = 'open'
    GROUP BY up.user_id, up.balance, up.used_margin, up.available_margin
  LOOP
    -- Check margin consistency
    IF user_record.used_margin != user_record.calculated_used_margin THEN
      margin_issues := margin_issues + 1;
      total_issues := total_issues + 1;
      issues_array := array_append(issues_array, json_build_object(
        'type', 'margin_inconsistency',
        'user_id', user_record.user_id,
        'stored_margin', user_record.used_margin,
        'calculated_margin', user_record.calculated_used_margin,
        'severity', 'high'
      ));
    END IF;
    
    -- Check balance consistency
    IF user_record.balance != (10000.00 + user_record.total_closed_pnl) THEN
      balance_issues := balance_issues + 1;
      total_issues := total_issues + 1;
      issues_array := array_append(issues_array, json_build_object(
        'type', 'balance_inconsistency',
        'user_id', user_record.user_id,
        'stored_balance', user_record.balance,
        'calculated_balance', (10000.00 + user_record.total_closed_pnl),
        'severity', 'high'
      ));
    END IF;
    
    -- Check available margin calculation
    IF user_record.available_margin != GREATEST(user_record.balance - user_record.used_margin, 0) THEN
      total_issues := total_issues + 1;
      issues_array := array_append(issues_array, json_build_object(
        'type', 'available_margin_error',
        'user_id', user_record.user_id,
        'stored_available', user_record.available_margin,
        'calculated_available', GREATEST(user_record.balance - user_record.used_margin, 0),
        'severity', 'medium'
      ));
    END IF;
  END LOOP;
  
  -- Check for orphaned trades (trades without valid user profiles)
  SELECT COUNT(*) INTO orphaned_trades
  FROM trades t
  LEFT JOIN user_profiles up ON t.user_id = up.user_id
  WHERE up.user_id IS NULL;
  
  IF orphaned_trades > 0 THEN
    total_issues := total_issues + 1;
    issues_array := array_append(issues_array, json_build_object(
      'type', 'orphaned_trades',
      'count', orphaned_trades,
      'severity', 'high'
    ));
  END IF;
  
  -- Check for invalid trade orders (orders with invalid asset references)
  SELECT COUNT(*) INTO invalid_orders
  FROM trade_orders to_table
  LEFT JOIN assets a ON to_table.asset_id = a.id
  WHERE a.id IS NULL;
  
  IF invalid_orders > 0 THEN
    total_issues := total_issues + 1;
    issues_array := array_append(issues_array, json_build_object(
      'type', 'invalid_orders',
      'count', invalid_orders,
      'severity', 'medium'
    ));
  END IF;
  
  -- Check for users without profiles but with trades
  FOR trade_record IN
    SELECT t.user_id, COUNT(*) as trade_count
    FROM trades t
    LEFT JOIN user_profiles up ON t.user_id = up.user_id
    WHERE up.user_id IS NULL
    GROUP BY t.user_id
  LOOP
    total_issues := total_issues + 1;
    issues_array := array_append(issues_array, json_build_object(
      'type', 'user_without_profile',
      'user_id', trade_record.user_id,
      'trade_count', trade_record.trade_count,
      'severity', 'critical'
    ));
  END LOOP;
  
  -- Compile health report
  health_report := json_build_object(
    'timestamp', now(),
    'status', CASE WHEN total_issues = 0 THEN 'healthy' ELSE 'issues_detected' END,
    'summary', json_build_object(
      'total_users', user_count,
      'total_issues', total_issues,
      'margin_issues', margin_issues,
      'balance_issues', balance_issues,
      'orphaned_trades', orphaned_trades,
      'invalid_orders', invalid_orders
    ),
    'issues', array_to_json(issues_array),
    'recommendations', CASE 
      WHEN total_issues > 0 THEN 
        json_build_array(
          'Run auto_recalculate_user_margins for affected users',
          'Enable real-time data synchronization',
          'Set up automated health checks',
          'Review data integrity constraints'
        )
      ELSE 
        json_build_array('System is healthy')
    END
  );
  
  RAISE NOTICE 'Health check completed: % issues found across % users', total_issues, user_count;
  
  RETURN health_report;
END;
$$;

-- Create an auto-fix function for common issues
CREATE OR REPLACE FUNCTION public.auto_fix_detected_issues()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  fix_report JSON;
  users_fixed INTEGER := 0;
  total_fixes INTEGER := 0;
  user_record RECORD;
BEGIN
  RAISE NOTICE 'Starting automatic issue fixes...';
  
  -- Fix margin and balance inconsistencies for all users
  FOR user_record IN SELECT DISTINCT user_id FROM user_profiles LOOP
    PERFORM public.auto_recalculate_user_margins(user_record.user_id);
    users_fixed := users_fixed + 1;
  END LOOP;
  
  total_fixes := users_fixed;
  
  -- Delete orphaned trades (trades without valid users)
  DELETE FROM trades 
  WHERE user_id NOT IN (SELECT user_id FROM user_profiles);
  
  -- Delete invalid trade orders (orders with invalid assets)
  DELETE FROM trade_orders 
  WHERE asset_id NOT IN (SELECT id FROM assets);
  
  fix_report := json_build_object(
    'timestamp', now(),
    'status', 'completed',
    'fixes_applied', json_build_object(
      'users_recalculated', users_fixed,
      'total_fixes', total_fixes
    ),
    'message', 'Automatic fixes completed successfully'
  );
  
  RAISE NOTICE 'Auto-fix completed: % users processed, % total fixes applied', users_fixed, total_fixes;
  
  RETURN fix_report;
END;
$$;

-- Enable realtime for critical tables
ALTER TABLE public.user_profiles REPLICA IDENTITY FULL;
ALTER TABLE public.trades REPLICA IDENTITY FULL;
ALTER TABLE public.trade_orders REPLICA IDENTITY FULL;
ALTER TABLE public.assets REPLICA IDENTITY FULL;

-- Add tables to realtime publication
DO $$
BEGIN
  -- Add user_profiles to realtime
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'user_profiles already in realtime publication';
  END;
  
  -- Add trades to realtime
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'trades already in realtime publication';
  END;
  
  -- Add trade_orders to realtime
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_orders;
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'trade_orders already in realtime publication';
  END;
  
  -- Add assets to realtime
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assets;
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'assets already in realtime publication';
  END;
END $$;

-- Create a notification function for real-time updates
CREATE OR REPLACE FUNCTION public.notify_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Notify clients of profile changes
  PERFORM pg_notify('profile_updated', json_build_object(
    'user_id', NEW.user_id,
    'balance', NEW.balance,
    'used_margin', NEW.used_margin,
    'available_margin', NEW.available_margin,
    'equity', NEW.equity,
    'updated_at', NEW.updated_at
  )::text);
  
  RETURN NEW;
END;
$$;

-- Create trigger for profile notifications
DROP TRIGGER IF EXISTS trigger_profile_changes ON user_profiles;
CREATE TRIGGER trigger_profile_changes
  AFTER UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION notify_profile_changes();

-- Schedule automated health checks (run every hour)
SELECT cron.schedule(
  'system-health-check',
  '0 * * * *',
  'SELECT public.run_system_health_check();'
);