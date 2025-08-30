-- Drop any existing faulty triggers first
DROP TRIGGER IF EXISTS trigger_handle_trade_opened ON trades;
DROP TRIGGER IF EXISTS trigger_handle_trade_closed ON trades;

-- Create a simple, reliable trigger function for trade operations
CREATE OR REPLACE FUNCTION handle_trade_margin_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    total_used_margin DECIMAL := 0;
    total_closed_pnl DECIMAL := 0;
    base_balance DECIMAL := 10000.00;
    new_balance DECIMAL;
BEGIN
    -- Handle trade opening (INSERT with status = 'open')
    IF TG_OP = 'INSERT' AND NEW.status = 'open' THEN
        RAISE NOTICE 'TRIGGER: New trade opened - ID: %, User: %, Margin: %', NEW.id, NEW.user_id, NEW.margin_used;
        
        -- Recalculate all margins for this user
        SELECT COALESCE(SUM(margin_used), 0) INTO total_used_margin
        FROM trades WHERE user_id = NEW.user_id AND status = 'open';
        
        SELECT COALESCE(SUM(pnl), 0) INTO total_closed_pnl
        FROM trades WHERE user_id = NEW.user_id AND status = 'closed';
        
        new_balance := base_balance + total_closed_pnl;
        
        UPDATE user_profiles
        SET 
            used_margin = total_used_margin,
            available_margin = GREATEST(new_balance - total_used_margin, 0),
            updated_at = now()
        WHERE user_id = NEW.user_id;
        
        RAISE NOTICE 'TRIGGER: Updated margins - Used: %, Available: %', total_used_margin, GREATEST(new_balance - total_used_margin, 0);
        
    -- Handle trade closing (UPDATE from open to closed)
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'open' AND NEW.status = 'closed' THEN
        RAISE NOTICE 'TRIGGER: Trade closed - ID: %, User: %, PnL: %', NEW.id, NEW.user_id, NEW.pnl;
        
        -- Recalculate all margins for this user
        SELECT COALESCE(SUM(margin_used), 0) INTO total_used_margin
        FROM trades WHERE user_id = NEW.user_id AND status = 'open';
        
        SELECT COALESCE(SUM(pnl), 0) INTO total_closed_pnl
        FROM trades WHERE user_id = NEW.user_id AND status = 'closed';
        
        new_balance := base_balance + total_closed_pnl;
        
        UPDATE user_profiles
        SET 
            balance = new_balance,
            equity = new_balance,
            used_margin = total_used_margin,
            available_margin = GREATEST(new_balance - total_used_margin, 0),
            updated_at = now()
        WHERE user_id = NEW.user_id;
        
        RAISE NOTICE 'TRIGGER: Updated after close - Balance: %, Used: %, Available: %', new_balance, total_used_margin, GREATEST(new_balance - total_used_margin, 0);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'TRIGGER ERROR: %', SQLERRM;
        RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create the triggers
CREATE TRIGGER trigger_trade_margin_insert
    AFTER INSERT ON trades
    FOR EACH ROW
    EXECUTE FUNCTION handle_trade_margin_update();

CREATE TRIGGER trigger_trade_margin_update  
    AFTER UPDATE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION handle_trade_margin_update();

-- Fix the current user's margin state immediately
DO $$
DECLARE
    total_used_margin DECIMAL := 0;
    total_closed_pnl DECIMAL := 0;
    base_balance DECIMAL := 10000.00;
    new_balance DECIMAL;
    user_uuid UUID := 'dc826791-17f9-4b7c-a9d1-155ff855a247';
BEGIN
    -- Calculate correct values for this specific user
    SELECT COALESCE(SUM(margin_used), 0) INTO total_used_margin
    FROM trades WHERE user_id = user_uuid AND status = 'open';
    
    SELECT COALESCE(SUM(pnl), 0) INTO total_closed_pnl  
    FROM trades WHERE user_id = user_uuid AND status = 'closed';
    
    new_balance := base_balance + total_closed_pnl;
    
    -- Update the user profile with correct values
    UPDATE user_profiles
    SET 
        balance = new_balance,
        equity = new_balance,
        used_margin = total_used_margin,
        available_margin = GREATEST(new_balance - total_used_margin, 0),
        updated_at = now()
    WHERE user_id = user_uuid;
    
    RAISE NOTICE 'FIXED USER MARGINS: Balance=%, Used=%, Available=%', 
        new_balance, total_used_margin, GREATEST(new_balance - total_used_margin, 0);
END $$;