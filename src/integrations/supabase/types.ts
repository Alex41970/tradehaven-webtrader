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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      [_ in never]: never
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
      admin_delete_trade: {
        Args: { _admin_id: string; _trade_id: string }
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
      admin_reset_account: {
        Args: {
          _admin_id: string
          _clear_history?: boolean
          _close_trades?: boolean
          _reset_balance?: boolean
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
      release_coordinator_lock: {
        Args: { p_instance_id: string }
        Returns: boolean
      }
      renew_coordinator_lock: {
        Args: { p_instance_id: string }
        Returns: boolean
      }
      run_system_health_check: { Args: never; Returns: Json }
      sync_admin_user_relationships: { Args: never; Returns: undefined }
      transfer_user_to_admin: {
        Args: { _new_admin_id: string; _user_id: string }
        Returns: boolean
      }
      try_acquire_coordinator_lock: {
        Args: { p_instance_id: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
