-- Create the missing triggers for automatic balance updates

-- Trigger for when a new trade is opened (reserves margin)
CREATE TRIGGER trigger_update_balance_on_trade_open
    AFTER INSERT ON public.trades
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_balance_on_trade_open();

-- Trigger for when a trade is closed (releases margin and applies P&L)
CREATE TRIGGER trigger_update_balance_on_trade_close
    AFTER UPDATE ON public.trades
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_balance_on_trade_close();