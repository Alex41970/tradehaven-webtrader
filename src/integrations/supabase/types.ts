export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          action_details: Json | null
          admin_id: string
          id: string
          ip_address: unknown
          new_value: Json | null
          old_value: Json | null
          performed_at: string | null
          reason: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          action_details?: Json | null
          admin_id: string
          id?: string
          ip_address?: unknown
          new_value?: Json | null
          old_value?: Json | null
          performed_at?: string | null
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          action_details?: Json | null
          admin_id?: string
          id?: string
          ip_address?: unknown
          new_value?: Json | null
          old_value?: Json | null
          performed_at?: string | null
          reason?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      admin_payment_settings: {
        Row: {
          admin_id: string
          bank_wire_details: Json | null
          created_at: string
          crypto_wallets: Json | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          admin_id: string
          bank_wire_details?: Json | null
          created_at?: string
          crypto_wallets?: Json | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          admin_id?: string
          bank_wire_details?: Json | null
          created_at?: string
          crypto_wallets?: Json | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      admin_user_relationships: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_admin_user_relationships_user_profiles"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      assets: {
        Row: {
          alltick_code: string | null
          alltick_supported: boolean | null
          base_currency: string | null
          category: string
          change_24h: number
          contract_size: number | null
          created_at: string
          id: string
          is_active: boolean
          max_leverage: number
          min_trade_size: number
          name: string
          price: number
          price_updated_at: string | null
          quote_currency: string | null
          spread: number
          symbol: string
          updated_at: string
        }
        Insert: {
          alltick_code?: string | null
          alltick_supported?: boolean | null
          base_currency?: string | null
          category: string
          change_24h?: number
          contract_size?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          max_leverage?: number
          min_trade_size?: number
          name: string
          price: number
          price_updated_at?: string | null
          quote_currency?: string | null
          spread?: number
          symbol: string
          updated_at?: string
        }
        Update: {
          alltick_code?: string | null
          alltick_supported?: boolean | null
          base_currency?: string | null
          category?: string
          change_24h?: number
          contract_size?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          max_leverage?: number
          min_trade_size?: number
          name?: string
          price?: number
          price_updated_at?: string | null
          quote_currency?: string | null
          spread?: number
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      bot_licenses: {
        Row: {
          admin_id: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          license_key: string
          updated_at: string
          used_by_user_id: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          license_key: string
          updated_at?: string
          used_by_user_id?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          license_key?: string
          updated_at?: string
          used_by_user_id?: string | null
        }
        Relationships: []
      }
      deposit_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          bank_details: Json | null
          created_at: string
          crypto_wallet_address: string | null
          deposit_type: string
          id: string
          processed_at: string | null
          processed_by_admin: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          bank_details?: Json | null
          created_at?: string
          crypto_wallet_address?: string | null
          deposit_type: string
          id?: string
          processed_at?: string | null
          processed_by_admin?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          bank_details?: Json | null
          created_at?: string
          crypto_wallet_address?: string | null
          deposit_type?: string
          id?: string
          processed_at?: string | null
          processed_by_admin?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_deposit_requests_user_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      price_history: {
        Row: {
          change_24h: number
          created_at: string
          id: string
          price: number
          snapshot_date: string
          symbol: string
        }
        Insert: {
          change_24h?: number
          created_at?: string
          id?: string
          price: number
          snapshot_date?: string
          symbol: string
        }
        Update: {
          change_24h?: number
          created_at?: string
          id?: string
          price?: number
          snapshot_date?: string
          symbol?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          admin_id: string
          code: string
          created_at: string
          current_uses: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
        }
        Insert: {
          admin_id: string
          code: string
          created_at?: string
          current_uses?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
        }
        Update: {
          admin_id?: string
          code?: string
          created_at?: string
          current_uses?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
        }
        Relationships: []
      }
      promo_validation_attempts: {
        Row: {
          attempted_at: string
          created_user_id: string | null
          error_reason: string | null
          id: string
          ip_address: unknown
          promo_code: string
          resulted_in_signup: boolean | null
          user_agent: string | null
          was_valid: boolean
        }
        Insert: {
          attempted_at?: string
          created_user_id?: string | null
          error_reason?: string | null
          id?: string
          ip_address?: unknown
          promo_code: string
          resulted_in_signup?: boolean | null
          user_agent?: string | null
          was_valid: boolean
        }
        Update: {
          attempted_at?: string
          created_user_id?: string | null
          error_reason?: string | null
          id?: string
          ip_address?: unknown
          promo_code?: string
          resulted_in_signup?: boolean | null
          user_agent?: string | null
          was_valid?: boolean
        }
        Relationships: []
      }
      trade_execution_log: {
        Row: {
          action: string
          executed_at: string | null
          executed_by: string | null
          executed_price: number | null
          execution_source: string | null
          id: string
          ip_address: unknown
          notes: string | null
          requested_price: number | null
          slippage_percent: number | null
          trade_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          executed_at?: string | null
          executed_by?: string | null
          executed_price?: number | null
          execution_source?: string | null
          id?: string
          ip_address?: unknown
          notes?: string | null
          requested_price?: number | null
          slippage_percent?: number | null
          trade_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          executed_at?: string | null
          executed_by?: string | null
          executed_price?: number | null
          execution_source?: string | null
          id?: string
          ip_address?: unknown
          notes?: string | null
          requested_price?: number | null
          slippage_percent?: number | null
          trade_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_execution_log_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_orders: {
        Row: {
          amount: number
          asset_id: string
          created_at: string
          expires_at: string | null
          filled_at: string | null
          id: string
          leverage: number
          max_slippage_percent: number | null
          order_type: string
          price_at_order: number | null
          status: string
          stop_loss_price: number | null
          symbol: string
          take_profit_price: number | null
          trade_type: string
          trigger_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          asset_id: string
          created_at?: string
          expires_at?: string | null
          filled_at?: string | null
          id?: string
          leverage?: number
          max_slippage_percent?: number | null
          order_type?: string
          price_at_order?: number | null
          status?: string
          stop_loss_price?: number | null
          symbol: string
          take_profit_price?: number | null
          trade_type: string
          trigger_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          asset_id?: string
          created_at?: string
          expires_at?: string | null
          filled_at?: string | null
          id?: string
          leverage?: number
          max_slippage_percent?: number | null
          order_type?: string
          price_at_order?: number | null
          status?: string
          stop_loss_price?: number | null
          symbol?: string
          take_profit_price?: number | null
          trade_type?: string
          trigger_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_trade_orders_assets"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_trade_orders_user_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      trades: {
        Row: {
          amount: number
          asset_id: string
          close_price: number | null
          closed_at: string | null
          created_at: string
          current_price: number | null
          id: string
          idempotency_key: string | null
          leverage: number
          margin_used: number
          open_price: number
          opened_at: string
          parent_order_id: string | null
          pnl: number | null
          price_age_ms: number | null
          slippage_percent: number | null
          status: string
          stop_loss_price: number | null
          symbol: string
          take_profit_price: number | null
          trade_source: string
          trade_type: string
          updated_at: string
          user_id: string
          version: number | null
        }
        Insert: {
          amount: number
          asset_id: string
          close_price?: number | null
          closed_at?: string | null
          created_at?: string
          current_price?: number | null
          id?: string
          idempotency_key?: string | null
          leverage?: number
          margin_used: number
          open_price: number
          opened_at?: string
          parent_order_id?: string | null
          pnl?: number | null
          price_age_ms?: number | null
          slippage_percent?: number | null
          status?: string
          stop_loss_price?: number | null
          symbol: string
          take_profit_price?: number | null
          trade_source?: string
          trade_type: string
          updated_at?: string
          user_id: string
          version?: number | null
        }
        Update: {
          amount?: number
          asset_id?: string
          close_price?: number | null
          closed_at?: string | null
          created_at?: string
          current_price?: number | null
          id?: string
          idempotency_key?: string | null
          leverage?: number
          margin_used?: number
          open_price?: number
          opened_at?: string
          parent_order_id?: string | null
          pnl?: number | null
          price_age_ms?: number | null
          slippage_percent?: number | null
          status?: string
          stop_loss_price?: number | null
          symbol?: string
          take_profit_price?: number | null
          trade_source?: string
          trade_type?: string
          updated_at?: string
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_trades_parent_order"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "trade_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_trades_user_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trades_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bot_status: {
        Row: {
          bot_status: string
          connected_at: string
          created_at: string
          id: string
          is_active: boolean
          license_key: string
          permissions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_status?: string
          connected_at?: string
          created_at?: string
          id?: string
          is_active?: boolean
          license_key: string
          permissions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_status?: string
          connected_at?: string
          created_at?: string
          id?: string
          is_active?: boolean
          license_key?: string
          permissions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_bot_status_user_profiles"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_favorites: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_favorites_user_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_favorites_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_payment_settings: {
        Row: {
          admin_id: string
          bank_wire_details: Json | null
          created_at: string
          crypto_wallets: Json | null
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_id: string
          bank_wire_details?: Json | null
          created_at?: string
          crypto_wallets?: Json | null
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_id?: string
          bank_wire_details?: Json | null
          created_at?: string
          crypto_wallets?: Json | null
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          admin_id: string | null
          assigned_at: string | null
          assignment_method: string | null
          available_margin: number
          balance: number
          created_at: string
          email: string | null
          equity: number
          first_name: string | null
          id: string
          last_activity_at: string | null
          last_login_at: string | null
          phone_number: string | null
          promo_code_used: string | null
          surname: string | null
          updated_at: string
          used_margin: number
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          assigned_at?: string | null
          assignment_method?: string | null
          available_margin?: number
          balance?: number
          created_at?: string
          email?: string | null
          equity?: number
          first_name?: string | null
          id?: string
          last_activity_at?: string | null
          last_login_at?: string | null
          phone_number?: string | null
          promo_code_used?: string | null
          surname?: string | null
          updated_at?: string
          used_margin?: number
          user_id: string
        }
        Update: {
          admin_id?: string | null
          assigned_at?: string | null
          assignment_method?: string | null
          available_margin?: number
          balance?: number
          created_at?: string
          email?: string | null
          equity?: number
          first_name?: string | null
          id?: string
          last_activity_at?: string | null
          last_login_at?: string | null
          phone_number?: string | null
          promo_code_used?: string | null
          surname?: string | null
          updated_at?: string
          used_margin?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          bank_details: Json | null
          created_at: string
          crypto_wallet_address: string | null
          id: string
          processed_at: string | null
          processed_by_admin: string | null
          status: string
          user_id: string
          withdrawal_type: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          bank_details?: Json | null
          created_at?: string
          crypto_wallet_address?: string | null
          id?: string
          processed_at?: string | null
          processed_by_admin?: string | null
          status?: string
          user_id: string
          withdrawal_type: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          bank_details?: Json | null
          created_at?: string
          crypto_wallet_address?: string | null
          id?: string
          processed_at?: string | null
          processed_by_admin?: string | null
          status?: string
          user_id?: string
          withdrawal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_withdrawal_requests_user_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_bot_license: {
        Args: { _license_key: string; _user_id: string }
        Returns: Json
      }
      admin_close_trade: {
        Args: { _admin_id: string; _close_price: number; _trade_id: string }
        Returns: Json
      }
      admin_create_trade: {
        Args: {
          _admin_id: string
          _amount: number
          _asset_id: string
          _leverage: number
          _open_price: number
          _symbol: string
          _trade_type: string
          _user_id: string
        }
        Returns: Json
      }
      admin_modify_trade_open_price: {
        Args: { _admin_id: string; _new_open_price: number; _trade_id: string }
        Returns: boolean
      }
      admin_modify_user_balance: {
        Args: {
          _admin_id: string
          _amount: number
          _operation: string
          _reason?: string
          _user_id: string
        }
        Returns: Json
      }
      assign_user_to_admin_via_promo: {
        Args: { _promo_code: string; _user_id: string }
        Returns: Json
      }
      auto_fix_detected_issues: { Args: never; Returns: Json }
      auto_recalculate_user_margins: {
        Args: { _user_id: string }
        Returns: undefined
      }
      calculate_pnl:
        | {
            Args: {
              amount: number
              current_price: number
              open_price: number
              trade_type: string
            }
            Returns: number
          }
        | {
            Args: {
              amount: number
              current_price: number
              leverage_param?: number
              open_price: number
              trade_type: string
            }
            Returns: number
          }
      check_and_liquidate_positions: {
        Args: { _user_id: string }
        Returns: Json
      }
      close_trade_with_pnl: {
        Args: { p_close_price: number; p_trade_id: string }
        Returns: Json
      }
      deactivate_and_disconnect_license: {
        Args: { _admin_id: string; _license_id: string }
        Returns: Json
      }
      gen_random_uuid: { Args: never; Returns: string }
      generate_bot_license: {
        Args: { _admin_id: string; _expires_at?: string }
        Returns: string
      }
      get_promo_code_stats: {
        Args: never
        Returns: {
          admin_email: string
          admin_id: string
          assigned_users_count: number
          code: string
          created_at: string
          current_uses: number
          expires_at: string
          id: string
          is_active: boolean
          max_uses: number
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_valid_bot_status: { Args: { _user_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_deposit_request: {
        Args: {
          _action: string
          _admin_id: string
          _admin_notes?: string
          _request_id: string
        }
        Returns: Json
      }
      process_withdrawal_request: {
        Args: {
          _action: string
          _admin_id: string
          _admin_notes?: string
          _request_id: string
        }
        Returns: Json
      }
      recalculate_user_margins: { Args: { _user_id: string }; Returns: Json }
      run_system_health_check: { Args: never; Returns: Json }
      sync_admin_user_relationships: { Args: never; Returns: undefined }
      transfer_user_to_admin: {
        Args: { _new_admin_id: string; _user_id: string }
        Returns: boolean
      }
      validate_promo_code_for_signup: {
        Args: { _promo_code: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "user"],
    },
  },
} as const
