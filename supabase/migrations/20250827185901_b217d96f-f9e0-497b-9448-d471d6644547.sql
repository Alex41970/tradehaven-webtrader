-- Create trigger for trade opening
CREATE TRIGGER update_user_balance_on_trade_open_trigger
  AFTER INSERT ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_balance_on_trade_open();