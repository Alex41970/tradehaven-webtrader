CREATE TABLE public.admin_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    user_id uuid,
    action text NOT NULL,
    old_value jsonb,
    new_value jsonb,
    reason text,
    ip_address inet,
    performed_at timestamp with time zone DEFAULT now(),
    action_details jsonb
);
CREATE TABLE public.admin_payment_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    crypto_wallets jsonb DEFAULT '{}'::jsonb,
    bank_wire_details jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.admin_trading_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    price_intensity text DEFAULT 'medium'::text NOT NULL,
    market_closed boolean DEFAULT false NOT NULL,
    trading_hours_enabled boolean DEFAULT false,
    market_open_time time without time zone DEFAULT '09:30:00'::time without time zone,
    market_close_time time without time zone DEFAULT '16:00:00'::time without time zone,
    trading_timezone text DEFAULT 'America/New_York'::text,
    trading_days text[] DEFAULT ARRAY['monday'::text, 'tuesday'::text, 'wednesday'::text, 'thursday'::text, 'friday'::text],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    margin_call_level integer DEFAULT 100,
    stop_out_level integer DEFAULT 50,
    allow_negative_balance boolean DEFAULT false,
    grace_period_hours integer DEFAULT 24,
    auto_close_enabled boolean DEFAULT true
);
CREATE TABLE public.admin_user_relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    symbol text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    price numeric(15,8) NOT NULL,
    change_24h numeric(8,4) DEFAULT 0.0000 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    min_trade_size numeric(10,4) DEFAULT 0.01 NOT NULL,
    max_leverage integer DEFAULT 100 NOT NULL,
    spread numeric(8,4) DEFAULT 0.0001 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    contract_size integer DEFAULT 1,
    base_currency text,
    quote_currency text,
    price_updated_at timestamp with time zone DEFAULT now(),
    price_source text DEFAULT 'pending'::text,
    last_ws_update timestamp with time zone DEFAULT now(),
    api_source text DEFAULT 'yahoo'::text,
    api_symbol text,
    CONSTRAINT assets_category_check CHECK ((category = ANY (ARRAY['forex'::text, 'crypto'::text, 'stocks'::text, 'commodities'::text, 'indices'::text])))
);
CREATE TABLE public.bot_licenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    license_key text NOT NULL,
    admin_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone,
    used_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.coordinator_lock (
    id text DEFAULT 'price-relay'::text NOT NULL,
    instance_id text NOT NULL,
    locked_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:00:45'::interval) NOT NULL,
    heartbeat_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT single_lock CHECK ((id = 'price-relay'::text))
);
CREATE TABLE public.deposit_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount numeric NOT NULL,
    deposit_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    crypto_wallet_address text,
    bank_details jsonb,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    processed_by_admin uuid,
    CONSTRAINT deposit_requests_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT deposit_requests_deposit_type_check CHECK ((deposit_type = ANY (ARRAY['crypto'::text, 'wire'::text, 'admin_adjustment'::text]))),
    CONSTRAINT deposit_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);
CREATE TABLE public.price_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    symbol text NOT NULL,
    price numeric NOT NULL,
    change_24h numeric DEFAULT 0 NOT NULL,
    snapshot_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.promo_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    admin_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    max_uses integer,
    current_uses integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone
);
CREATE TABLE public.promo_validation_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promo_code text NOT NULL,
    attempted_at timestamp with time zone DEFAULT now() NOT NULL,
    was_valid boolean NOT NULL,
    error_reason text,
    ip_address inet,
    user_agent text,
    resulted_in_signup boolean DEFAULT false,
    created_user_id uuid
);
CREATE TABLE public.trade_execution_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trade_id uuid,
    user_id uuid NOT NULL,
    action text NOT NULL,
    requested_price numeric,
    executed_price numeric,
    slippage_percent numeric,
    execution_source text,
    executed_at timestamp with time zone DEFAULT now(),
    executed_by uuid,
    ip_address inet,
    user_agent text,
    notes text
);
CREATE TABLE public.trade_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    symbol text NOT NULL,
    order_type text DEFAULT 'market'::text NOT NULL,
    trade_type text NOT NULL,
    amount numeric NOT NULL,
    leverage integer DEFAULT 1 NOT NULL,
    trigger_price numeric,
    stop_loss_price numeric,
    take_profit_price numeric,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone,
    filled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    max_slippage_percent numeric DEFAULT 0.5,
    price_at_order numeric
);
CREATE TABLE public.trades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    symbol text NOT NULL,
    trade_type text NOT NULL,
    amount numeric(15,4) NOT NULL,
    leverage integer DEFAULT 1 NOT NULL,
    open_price numeric(15,8) NOT NULL,
    close_price numeric(15,8),
    current_price numeric(15,8),
    pnl numeric(15,2) DEFAULT 0.00,
    margin_used numeric(15,2) NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    trade_source text DEFAULT 'user'::text NOT NULL,
    stop_loss_price numeric,
    take_profit_price numeric,
    parent_order_id uuid,
    idempotency_key uuid,
    version integer DEFAULT 0,
    slippage_percent numeric,
    price_age_ms integer,
    CONSTRAINT trades_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text]))),
    CONSTRAINT trades_trade_source_check CHECK ((trade_source = ANY (ARRAY['bot'::text, 'user'::text]))),
    CONSTRAINT trades_trade_type_check CHECK ((trade_type = ANY (ARRAY['BUY'::text, 'SELL'::text])))
);
CREATE TABLE public.user_bot_status (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    license_key text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    bot_status text DEFAULT 'active'::text NOT NULL,
    connected_at timestamp with time zone DEFAULT now() NOT NULL,
    permissions jsonb DEFAULT '{"history_access": true, "trade_execution": true, "analytics_access": true}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_bot_status_bot_status_check CHECK ((bot_status = ANY (ARRAY['active'::text, 'paused'::text])))
);
CREATE TABLE public.user_favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.user_payment_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    admin_id uuid NOT NULL,
    crypto_wallets jsonb DEFAULT '{}'::jsonb,
    bank_wire_details jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.user_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text,
    balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    equity numeric(15,2) DEFAULT 0.00 NOT NULL,
    used_margin numeric(15,2) DEFAULT 0.00 NOT NULL,
    available_margin numeric(15,2) DEFAULT 0.00 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    admin_id uuid,
    promo_code_used text,
    assignment_method text DEFAULT 'manual'::text,
    assigned_at timestamp with time zone DEFAULT now(),
    first_name text,
    surname text,
    phone_number text,
    last_activity_at timestamp with time zone,
    account_status text DEFAULT 'active'::text,
    grace_period_until timestamp with time zone,
    frozen_at timestamp with time zone,
    frozen_reason text
);
CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.withdrawal_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount numeric NOT NULL,
    withdrawal_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    crypto_wallet_address text,
    bank_details jsonb,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    processed_by_admin uuid,
    CONSTRAINT withdrawal_requests_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT withdrawal_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT withdrawal_requests_withdrawal_type_check CHECK ((withdrawal_type = ANY (ARRAY['crypto'::text, 'wire'::text, 'admin_adjustment'::text])))
);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_payment_settings TO authenticated;
GRANT ALL ON public.admin_payment_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_trading_settings TO authenticated;
GRANT ALL ON public.admin_trading_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_user_relationships TO authenticated;
GRANT ALL ON public.admin_user_relationships TO service_role;
GRANT SELECT ON public.assets TO anon, authenticated;
GRANT ALL ON public.assets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_licenses TO authenticated;
GRANT ALL ON public.bot_licenses TO service_role;
GRANT ALL ON public.coordinator_lock TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deposit_requests TO authenticated;
GRANT ALL ON public.deposit_requests TO service_role;
GRANT SELECT ON public.price_history TO anon, authenticated;
GRANT ALL ON public.price_history TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
GRANT SELECT, INSERT ON public.promo_validation_attempts TO authenticated;
GRANT ALL ON public.promo_validation_attempts TO service_role;
GRANT SELECT, INSERT ON public.trade_execution_log TO authenticated;
GRANT ALL ON public.trade_execution_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_orders TO authenticated;
GRANT ALL ON public.trade_orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated;
GRANT ALL ON public.trades TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_bot_status TO authenticated;
GRANT ALL ON public.user_bot_status TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_favorites TO authenticated;
GRANT ALL ON public.user_favorites TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_payment_settings TO authenticated;
GRANT ALL ON public.user_payment_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;

ALTER TABLE ONLY public.admin_audit_log ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.admin_payment_settings ADD CONSTRAINT admin_payment_settings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.admin_trading_settings ADD CONSTRAINT admin_trading_settings_admin_id_key UNIQUE (admin_id);
ALTER TABLE ONLY public.admin_trading_settings ADD CONSTRAINT admin_trading_settings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.admin_user_relationships ADD CONSTRAINT admin_user_relationships_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.admin_user_relationships ADD CONSTRAINT admin_user_relationships_user_id_key UNIQUE (user_id);
ALTER TABLE ONLY public.assets ADD CONSTRAINT assets_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.assets ADD CONSTRAINT assets_symbol_key UNIQUE (symbol);
ALTER TABLE ONLY public.bot_licenses ADD CONSTRAINT bot_licenses_license_key_key UNIQUE (license_key);
ALTER TABLE ONLY public.bot_licenses ADD CONSTRAINT bot_licenses_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.coordinator_lock ADD CONSTRAINT coordinator_lock_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.deposit_requests ADD CONSTRAINT deposit_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.price_history ADD CONSTRAINT price_history_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.price_history ADD CONSTRAINT price_history_symbol_snapshot_date_key UNIQUE (symbol, snapshot_date);
ALTER TABLE ONLY public.promo_codes ADD CONSTRAINT promo_codes_code_key UNIQUE (code);
ALTER TABLE ONLY public.promo_codes ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.promo_validation_attempts ADD CONSTRAINT promo_validation_attempts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.trade_execution_log ADD CONSTRAINT trade_execution_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.trade_orders ADD CONSTRAINT trade_orders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.trades ADD CONSTRAINT trades_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_bot_status ADD CONSTRAINT user_bot_status_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_bot_status ADD CONSTRAINT user_bot_status_user_id_key UNIQUE (user_id);
ALTER TABLE ONLY public.user_favorites ADD CONSTRAINT user_favorites_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_favorites ADD CONSTRAINT user_favorites_user_id_asset_id_key UNIQUE (user_id, asset_id);
ALTER TABLE ONLY public.user_payment_settings ADD CONSTRAINT user_payment_settings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_payment_settings ADD CONSTRAINT user_payment_settings_user_id_key UNIQUE (user_id);
ALTER TABLE ONLY public.user_profiles ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_profiles ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);
ALTER TABLE ONLY public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
ALTER TABLE ONLY public.user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
ALTER TABLE ONLY public.withdrawal_requests ADD CONSTRAINT withdrawal_requests_pkey PRIMARY KEY (id);

CREATE INDEX idx_assets_last_ws_update ON public.assets USING btree (last_ws_update);
CREATE INDEX idx_assets_price_source ON public.assets USING btree (price_source);
CREATE INDEX idx_price_history_date ON public.price_history USING btree (snapshot_date DESC);
CREATE INDEX idx_price_history_symbol_date ON public.price_history USING btree (symbol, snapshot_date DESC);
CREATE INDEX idx_promo_validation_attempts_code ON public.promo_validation_attempts USING btree (promo_code);
CREATE INDEX idx_promo_validation_attempts_date ON public.promo_validation_attempts USING btree (attempted_at DESC);
CREATE INDEX idx_trade_execution_log_user_action ON public.trade_execution_log USING btree (user_id, action, executed_at DESC);
CREATE INDEX idx_trade_orders_pending_monitoring ON public.trade_orders USING btree (status, expires_at) WHERE ((status = 'pending'::text) AND (expires_at IS NOT NULL));
CREATE INDEX idx_trade_orders_trigger_price ON public.trade_orders USING btree (trigger_price) WHERE (status = 'pending'::text);
CREATE INDEX idx_trade_orders_user_status ON public.trade_orders USING btree (user_id, status);
CREATE INDEX idx_trades_sl_tp_monitoring ON public.trades USING btree (status, stop_loss_price, take_profit_price, user_id) WHERE ((status = 'open'::text) AND ((stop_loss_price IS NOT NULL) OR (take_profit_price IS NOT NULL)));
CREATE INDEX idx_trades_user_status_opened ON public.trades USING btree (user_id, status, opened_at DESC);
CREATE INDEX idx_user_profiles_last_activity ON public.user_profiles USING btree (last_activity_at);
CREATE UNIQUE INDEX trades_idempotency_key_idx ON public.trades USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);

CREATE TRIGGER check_margin_before_update BEFORE UPDATE ON public.user_profiles FOR EACH ROW WHEN ((new.available_margin IS DISTINCT FROM old.available_margin)) EXECUTE FUNCTION public.prevent_negative_margin();
CREATE TRIGGER enforce_single_role_per_user BEFORE INSERT ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.validate_role_transition();
CREATE TRIGGER final_balance_validation_trigger BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.validate_user_balance();
CREATE TRIGGER final_timestamp_trigger BEFORE UPDATE ON public.trades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER prevent_user_financial_updates_trigger BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_user_financial_updates();
CREATE TRIGGER tr_handle_trade_closed AFTER UPDATE ON public.trades FOR EACH ROW EXECUTE FUNCTION public.handle_trade_closed();
CREATE TRIGGER tr_handle_trade_opened AFTER INSERT ON public.trades FOR EACH ROW EXECUTE FUNCTION public.handle_trade_opened();
CREATE TRIGGER trigger_profile_changes AFTER UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.notify_profile_changes();
CREATE TRIGGER trigger_validate_user_balance BEFORE INSERT OR UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.validate_user_balance();
CREATE TRIGGER update_admin_payment_settings_updated_at BEFORE UPDATE ON public.admin_payment_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_admin_trading_settings_updated_at BEFORE UPDATE ON public.admin_trading_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bot_licenses_updated_at BEFORE UPDATE ON public.bot_licenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trade_orders_updated_at BEFORE UPDATE ON public.trade_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_bot_status_updated_at BEFORE UPDATE ON public.user_bot_status FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_payment_settings_updated_at BEFORE UPDATE ON public.user_payment_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE ONLY public.user_profiles ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_profiles ADD CONSTRAINT user_profiles_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.user_profiles(user_id) ON DELETE SET NULL;
ALTER TABLE ONLY public.admin_user_relationships ADD CONSTRAINT admin_user_relationships_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.admin_user_relationships ADD CONSTRAINT fk_admin_user_relationships_user_profiles FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.deposit_requests ADD CONSTRAINT fk_deposit_requests_user_profiles FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.trade_orders ADD CONSTRAINT fk_trade_orders_assets FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.trade_orders ADD CONSTRAINT fk_trade_orders_user_profiles FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.trades ADD CONSTRAINT fk_trades_parent_order FOREIGN KEY (parent_order_id) REFERENCES public.trade_orders(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.trades ADD CONSTRAINT fk_trades_user_profiles FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.trades ADD CONSTRAINT trades_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);
ALTER TABLE ONLY public.user_bot_status ADD CONSTRAINT fk_user_bot_status_user_profiles FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_favorites ADD CONSTRAINT fk_user_favorites_user_profiles FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_favorites ADD CONSTRAINT user_favorites_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.withdrawal_requests ADD CONSTRAINT fk_withdrawal_requests_user_profiles FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.promo_codes ADD CONSTRAINT promo_codes_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.trade_execution_log ADD CONSTRAINT trade_execution_log_trade_id_fkey FOREIGN KEY (trade_id) REFERENCES public.trades(id) ON DELETE CASCADE;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_trading_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coordinator_lock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_validation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bot_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can delete assigned users trades" ON public.trades FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = trades.user_id))))));
CREATE POLICY "Admins can delete payment settings for their users" ON public.user_payment_settings FOR DELETE TO authenticated USING (((auth.uid() = admin_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Admins can insert audit entries" ON public.admin_audit_log FOR INSERT TO authenticated WITH CHECK ((auth.uid() = admin_id));
CREATE POLICY "Admins can insert payment settings for their users" ON public.user_payment_settings FOR INSERT TO authenticated WITH CHECK (((auth.uid() = admin_id) AND (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = user_payment_settings.user_id)))))));
CREATE POLICY "Admins can manage own trading settings" ON public.admin_trading_settings TO authenticated USING (((auth.uid() = admin_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Admins can manage their own licenses" ON public.bot_licenses TO authenticated USING (((auth.uid() = admin_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Admins can manage their own payment settings" ON public.admin_payment_settings TO authenticated USING (((auth.uid() = admin_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Users can read their admin payment settings" ON public.admin_payment_settings FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = admin_payment_settings.admin_id) AND (admin_user_relationships.user_id = auth.uid())))));
CREATE POLICY "Admins can manage their own promo codes" ON public.promo_codes TO authenticated USING (((auth.uid() = admin_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Admins can update assigned user deposit requests only" ON public.deposit_requests FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = deposit_requests.user_id)))))) WITH CHECK ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = deposit_requests.user_id))))));
CREATE POLICY "Admins can update assigned users only" ON public.user_profiles FOR UPDATE TO authenticated USING (((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)) AND ((EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = user_profiles.user_id)))) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)))) WITH CHECK (((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)) AND ((EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = user_profiles.user_id)))) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))));
CREATE POLICY "Admins can update assigned users' trades" ON public.trades FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = trades.user_id)))))) WITH CHECK ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = trades.user_id))))));
CREATE POLICY "Admins can update payment settings for their users" ON public.user_payment_settings FOR UPDATE TO authenticated USING (((auth.uid() = admin_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))) WITH CHECK (((auth.uid() = admin_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Admins can update withdrawal requests for their users" ON public.withdrawal_requests FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = withdrawal_requests.user_id))))));
CREATE POLICY "Admins can view assigned user profiles only" ON public.user_profiles FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) AND (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = user_profiles.user_id))))));
CREATE POLICY "Admins can view assigned users trade orders" ON public.trade_orders FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = trade_orders.user_id))))));
CREATE POLICY "Admins can view payment settings for their users" ON public.user_payment_settings FOR SELECT TO authenticated USING (((auth.uid() = admin_id) OR (auth.uid() = user_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Admins can view their user relationships" ON public.admin_user_relationships FOR SELECT TO authenticated USING (((auth.uid() = admin_id) OR (auth.uid() = user_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Admins can view their users' bot status" ON public.user_bot_status FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = user_bot_status.user_id))))));
CREATE POLICY "Admins can view validation attempts" ON public.promo_validation_attempts FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Assets are viewable by everyone" ON public.assets FOR SELECT USING (true);
CREATE POLICY "Price history is viewable by everyone" ON public.price_history FOR SELECT USING (true);
CREATE POLICY "Super admins can manage all relationships" ON public.admin_user_relationships TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Super admins can manage all roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Super admins can update any profile" ON public.user_profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Super admins can view admin audit" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR auth.uid() = admin_id);
CREATE POLICY "Super admins can view all profiles" ON public.user_profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Super admins can view audit logs" ON public.trade_execution_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR auth.uid() = user_id);
CREATE POLICY "Users can insert own execution logs" ON public.trade_execution_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users and admins can create deposit requests" ON public.deposit_requests FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = deposit_requests.user_id))))));
CREATE POLICY "Users and admins can create withdrawal requests" ON public.withdrawal_requests FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = withdrawal_requests.user_id))))));
CREATE POLICY "Users and their admins can view trades" ON public.trades FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = trades.user_id))))));
CREATE POLICY "Users can create their own trade orders" ON public.trade_orders FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can create their own trades" ON public.trades FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can insert own profile only" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can manage their own bot status" ON public.user_bot_status TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can manage their own favorites" ON public.user_favorites TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can read their admin trading settings" ON public.admin_trading_settings FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = admin_trading_settings.admin_id) AND (admin_user_relationships.user_id = auth.uid())))));
CREATE POLICY "Users can update own basic info only" ON public.user_profiles FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own trade orders" ON public.trade_orders FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own trades" ON public.trades FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view licenses they're using" ON public.bot_licenses FOR SELECT TO authenticated USING (((auth.uid() = used_by_user_id) OR (auth.uid() = admin_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));
CREATE POLICY "Users can view own deposit requests only" ON public.deposit_requests FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = deposit_requests.user_id))))));
CREATE POLICY "Users can view own profile only" ON public.user_profiles FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));
CREATE POLICY "Users can view their own trade orders" ON public.trade_orders FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own withdrawal requests" ON public.withdrawal_requests FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR (EXISTS ( SELECT 1 FROM public.admin_user_relationships WHERE ((admin_user_relationships.admin_id = auth.uid()) AND (admin_user_relationships.user_id = withdrawal_requests.user_id))))));

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_promo_code_for_signup(text) TO anon;
REVOKE EXECUTE ON FUNCTION public.try_acquire_coordinator_lock(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.renew_coordinator_lock(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.release_coordinator_lock(text) FROM authenticated;