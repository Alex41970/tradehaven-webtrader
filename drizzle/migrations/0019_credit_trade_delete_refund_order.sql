CREATE OR REPLACE FUNCTION public.admin_delete_trade(_admin_id uuid, _trade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _trade RECORD; p RECORD;
  v_refund numeric := 0; v_reset_at timestamptz; v_ledger_reset_at timestamptz; v_closed_at timestamptz;
  v_outstanding numeric; v_undo_reset numeric := 0; v_restore numeric := 0; v_to_balance numeric := 0;
  v_before_reset boolean := false;
BEGIN
  IF auth.uid() IS NOT NULL AND _admin_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT * INTO _trade FROM trades WHERE id = _trade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM admin_user_relationships WHERE admin_id = _admin_id AND user_id = _trade.user_id)
     AND NOT has_role(_admin_id, 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;
  SELECT * INTO p FROM user_profiles WHERE user_id = _trade.user_id FOR UPDATE;

  DELETE FROM trades WHERE id = _trade_id;

  IF _trade.status = 'closed' AND COALESCE(_trade.pnl, 0) <> 0 THEN
    v_closed_at := COALESCE(_trade.closed_at, _trade.updated_at);
    -- last time this account's money was reset to zero
    SELECT max(created_at) INTO v_ledger_reset_at FROM credit_transactions
    WHERE user_id = _trade.user_id AND type = 'account_reset';
    SELECT GREATEST(v_ledger_reset_at, max(performed_at)) INTO v_reset_at FROM admin_audit_log
    WHERE user_id = _trade.user_id AND action = 'account_reset' AND action_details->>'reset_balance' = 'true';
    v_reset_at := COALESCE(v_reset_at, v_ledger_reset_at);

    IF v_reset_at IS NOT NULL AND v_closed_at <= v_reset_at THEN
      -- The reset already wiped this trade's result: removing it changes no money
      v_before_reset := true;
    ELSE
      v_refund := -_trade.pnl;  -- positive when the deleted trade was a loss
      IF v_refund > 0 THEN
        -- A refund unwinds the account's funding in reverse order, so credit can never come back as cash:
        -- a) negative balance the company cleared
        SELECT GREATEST(COALESCE(sum(balance_change), 0), 0) INTO v_outstanding
        FROM credit_transactions
        WHERE user_id = _trade.user_id AND type IN ('negative_balance_reset', 'negative_balance_reset_reversal')
          AND (v_ledger_reset_at IS NULL OR created_at > v_ledger_reset_at);
        v_undo_reset := LEAST(v_refund, v_outstanding);
        v_refund := v_refund - v_undo_reset;

        -- b) credit that was used to cover losses: returned as credit
        SELECT GREATEST(COALESCE(-sum(amount), 0), 0) INTO v_outstanding
        FROM credit_transactions
        WHERE user_id = _trade.user_id AND type IN ('loss_cover', 'loss_cover_reversal')
          AND (v_ledger_reset_at IS NULL OR created_at > v_ledger_reset_at);
        v_restore := LEAST(v_refund, v_outstanding);
        v_refund := v_refund - v_restore;

        -- c) what is left was the client's own money
        v_to_balance := v_refund;
      ELSE
        v_to_balance := v_refund;  -- taking a profit back
      END IF;

      UPDATE user_profiles SET balance = balance + v_to_balance, credit = credit + v_restore, updated_at = now()
      WHERE user_id = _trade.user_id;
      IF v_undo_reset > 0 THEN
        INSERT INTO credit_transactions (user_id, type, amount, balance_change, credit_after, balance_after, reason, performed_by, trade_id)
        VALUES (_trade.user_id, 'negative_balance_reset_reversal', 0, -v_undo_reset, p.credit + v_restore, p.balance + v_to_balance,
                'Trade deleted by admin: earlier negative-balance clearing no longer needed', _admin_id, _trade_id);
      END IF;
      IF v_restore > 0 THEN
        INSERT INTO credit_transactions (user_id, type, amount, balance_change, credit_after, balance_after, reason, performed_by, trade_id)
        VALUES (_trade.user_id, 'loss_cover_reversal', v_restore, -v_restore, p.credit + v_restore, p.balance + v_to_balance,
                'Trade deleted by admin: credit that covered losses was returned', _admin_id, _trade_id);
      END IF;
    END IF;
  END IF;

  PERFORM settle_account(_trade.user_id, NULL);

  INSERT INTO admin_audit_log (admin_id, user_id, action, old_value, action_details)
  VALUES (
    _admin_id, _trade.user_id, 'trade_deleted', row_to_json(_trade)::jsonb,
    jsonb_build_object('trade_id', _trade_id, 'was_open', _trade.status = 'open',
                       'balance_change', v_to_balance, 'credit_returned', v_restore,
                       'write_off_cancelled', v_undo_reset, 'closed_before_reset', v_before_reset)
  );
  RETURN jsonb_build_object(
    'success', true,
    'trade_id', _trade_id,
    'was_open', _trade.status = 'open',
    'margin_released', CASE WHEN _trade.status = 'open' THEN _trade.margin_used ELSE 0 END,
    'pnl_reversed', CASE WHEN _trade.status = 'closed' AND NOT v_before_reset THEN _trade.pnl ELSE 0 END,
    'balance_change', v_to_balance,
    'credit_returned', v_restore,
    'write_off_cancelled', v_undo_reset,
    'closed_before_reset', v_before_reset
  );
END;
$$;