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
        Relationships: []
      }
      assets: {
        Row: {
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
          quote_currency: string | null
          spread: number
          symbol: string
          updated_at: string
        }
        Insert: {
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
          quote_currency?: string | null
          spread?: number
          symbol: string
          updated_at?: string
        }
        Update: {
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
          quote_currency?: string | null
          spread?: number
          symbol?: string
          updated_at?: string
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
      trades: {
        Row: {
          amount: number
          asset_id: string
          close_price: number | null
          closed_at: string | null
          created_at: string
          current_price: number | null
          id: string
          leverage: number
          margin_used: number
          open_price: number
          opened_at: string
          pnl: number | null
          status: string
          symbol: string
          trade_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          asset_id: string
          close_price?: number | null
          closed_at?: string | null
          created_at?: string
          current_price?: number | null
          id?: string
          leverage?: number
          margin_used: number
          open_price: number
          opened_at?: string
          pnl?: number | null
          status?: string
          symbol: string
          trade_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          asset_id?: string
          close_price?: number | null
          closed_at?: string | null
          created_at?: string
          current_price?: number | null
          id?: string
          leverage?: number
          margin_used?: number
          open_price?: number
          opened_at?: string
          pnl?: number | null
          status?: string
          symbol?: string
          trade_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
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
            foreignKeyName: "user_favorites_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
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
          id: string
          promo_code_used: string | null
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
          id?: string
          promo_code_used?: string | null
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
          id?: string
          promo_code_used?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_modify_trade_open_price: {
        Args: { _admin_id: string; _new_open_price: number; _trade_id: string }
        Returns: boolean
      }
      admin_modify_user_balance: {
        Args: {
          _admin_id: string
          _amount: number
          _operation: string
          _user_id: string
        }
        Returns: boolean
      }
      assign_user_to_admin_via_promo: {
        Args: { _promo_code: string; _user_id: string }
        Returns: Json
      }
      calculate_pnl: {
        Args:
          | {
              amount: number
              current_price: number
              leverage_param?: number
              open_price: number
              trade_type: string
            }
          | {
              amount: number
              current_price: number
              open_price: number
              trade_type: string
            }
        Returns: number
      }
      get_promo_code_stats: {
        Args: Record<PropertyKey, never>
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalculate_user_balance: {
        Args: { user_uuid: string }
        Returns: undefined
      }
      sync_admin_user_relationships: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      transfer_user_to_admin: {
        Args: { _new_admin_id: string; _user_id: string }
        Returns: boolean
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
