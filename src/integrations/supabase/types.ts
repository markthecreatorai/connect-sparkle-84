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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          beneficiary_id: string
          created_at: string | null
          deposit_id: string
          id: string
          level: number
          origin_payment_id: string | null
          percentage: number
          source_user_id: string
          type: string
          vip_plan_id: string | null
        }
        Insert: {
          amount: number
          beneficiary_id: string
          created_at?: string | null
          deposit_id: string
          id?: string
          level: number
          origin_payment_id?: string | null
          percentage: number
          source_user_id: string
          type?: string
          vip_plan_id?: string | null
        }
        Update: {
          amount?: number
          beneficiary_id?: string
          created_at?: string | null
          deposit_id?: string
          id?: string
          level?: number
          origin_payment_id?: string | null
          percentage?: number
          source_user_id?: string
          type?: string
          vip_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_source_user_id_fkey"
            columns: ["source_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_vip_plan_id_fkey"
            columns: ["vip_plan_id"]
            isOneToOne: false
            referencedRelation: "vip_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_tasks: {
        Row: {
          created_at: string | null
          id: string
          is_completed: boolean | null
          reward_per_task: number
          task_date: string
          tasks_completed: number
          tasks_required: number
          total_earned: number
          user_id: string
          vip_level: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          reward_per_task?: number
          task_date?: string
          tasks_completed?: number
          tasks_required?: number
          total_earned?: number
          user_id: string
          vip_level: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          reward_per_task?: number
          task_date?: string
          tasks_completed?: number
          tasks_required?: number
          total_earned?: number
          user_id?: string
          vip_level?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          admin_notes: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          proof_url: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          proof_url?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          proof_url?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposits_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          duration_days: number
          from_income: number | null
          from_personal: number | null
          from_recharge: number | null
          id: string
          interest_rate: number
          matures_at: string
          profit_amount: number
          returned_at: string | null
          started_at: string | null
          status: string | null
          total_amount: number
          user_id: string
        }
        Insert: {
          duration_days: number
          from_income?: number | null
          from_personal?: number | null
          from_recharge?: number | null
          id?: string
          interest_rate: number
          matures_at: string
          profit_amount?: number
          returned_at?: string | null
          started_at?: string | null
          status?: string | null
          total_amount: number
          user_id: string
        }
        Update: {
          duration_days?: number
          from_income?: number | null
          from_personal?: number | null
          from_recharge?: number | null
          id?: string
          interest_rate?: number
          matures_at?: string
          profit_amount?: number
          returned_at?: string | null
          started_at?: string | null
          status?: string | null
          total_amount?: number
          user_id?: string
        }
        Relationships: []
      }
      platform_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          balance: number | null
          blocked_balance: number | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          pix_key: string | null
          pix_key_type: string | null
          referral_code: string
          referred_by: string | null
          updated_at: string | null
          vip_level: number | null
          vip_purchased_at: string | null
        }
        Insert: {
          balance?: number | null
          blocked_balance?: number | null
          created_at?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean | null
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          referral_code?: string
          referred_by?: string | null
          updated_at?: string | null
          vip_level?: number | null
          vip_purchased_at?: string | null
        }
        Update: {
          balance?: number | null
          blocked_balance?: number | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          referral_code?: string
          referred_by?: string | null
          updated_at?: string | null
          vip_level?: number | null
          vip_purchased_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_tree: {
        Row: {
          id: string
          is_active: boolean
          joined_at: string
          level_a_referrer: string | null
          level_b_referrer: string | null
          level_c_referrer: string | null
          referral_code: string
          referrer_id: string | null
          user_id: string
          vip_level: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          joined_at?: string
          level_a_referrer?: string | null
          level_b_referrer?: string | null
          level_c_referrer?: string | null
          referral_code?: string
          referrer_id?: string | null
          user_id: string
          vip_level?: string
        }
        Update: {
          id?: string
          is_active?: boolean
          joined_at?: string
          level_a_referrer?: string | null
          level_b_referrer?: string | null
          level_c_referrer?: string | null
          referral_code?: string
          referrer_id?: string | null
          user_id?: string
          vip_level?: string
        }
        Relationships: []
      }
      team_positions: {
        Row: {
          display_name: string
          id: number
          monthly_salary: number
          position_code: string
          required_direct_referrals: number | null
          required_total_team: number | null
          sort_order: number | null
        }
        Insert: {
          display_name: string
          id?: number
          monthly_salary?: number
          position_code: string
          required_direct_referrals?: number | null
          required_total_team?: number | null
          sort_order?: number | null
        }
        Update: {
          display_name?: string
          id?: number
          monthly_salary?: number
          position_code?: string
          required_direct_referrals?: number | null
          required_total_team?: number | null
          sort_order?: number | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          balance_after: number | null
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          reference_id: string | null
          status: string
          type: string
          user_id: string
          wallet_type: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          balance_after?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          status?: string
          type: string
          user_id: string
          wallet_type?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          balance_after?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          status?: string
          type?: string
          user_id?: string
          wallet_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vip_levels: {
        Row: {
          created_at: string | null
          daily_income: number
          daily_tasks: number
          deposit_required: number
          display_name: string
          id: string
          is_available: boolean
          level_code: string
          min_direct_referrals: number
          monthly_income: number
          reward_per_task: number
          sort_order: number
          yearly_income: number
        }
        Insert: {
          created_at?: string | null
          daily_income?: number
          daily_tasks?: number
          deposit_required?: number
          display_name: string
          id?: string
          is_available?: boolean
          level_code: string
          min_direct_referrals?: number
          monthly_income?: number
          reward_per_task?: number
          sort_order?: number
          yearly_income?: number
        }
        Update: {
          created_at?: string | null
          daily_income?: number
          daily_tasks?: number
          deposit_required?: number
          display_name?: string
          id?: string
          is_available?: boolean
          level_code?: string
          min_direct_referrals?: number
          monthly_income?: number
          reward_per_task?: number
          sort_order?: number
          yearly_income?: number
        }
        Relationships: []
      }
      vip_plans: {
        Row: {
          color_hex: string
          commission_a_pct: number
          commission_b_pct: number
          commission_c_pct: number
          created_at: string | null
          id: string
          level: number
          name: string
          price: number
          reward_a: number
          reward_b: number
          reward_c: number
        }
        Insert: {
          color_hex?: string
          commission_a_pct?: number
          commission_b_pct?: number
          commission_c_pct?: number
          created_at?: string | null
          id?: string
          level: number
          name: string
          price: number
          reward_a: number
          reward_b: number
          reward_c: number
        }
        Update: {
          color_hex?: string
          commission_a_pct?: number
          commission_b_pct?: number
          commission_c_pct?: number
          created_at?: string | null
          id?: string
          level?: number
          name?: string
          price?: number
          reward_a?: number
          reward_b?: number
          reward_c?: number
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number | null
          id: string
          updated_at: string | null
          user_id: string
          wallet_type: string
        }
        Insert: {
          balance?: number | null
          id?: string
          updated_at?: string | null
          user_id: string
          wallet_type: string
        }
        Update: {
          balance?: number | null
          id?: string
          updated_at?: string | null
          user_id?: string
          wallet_type?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_notes: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          fee: number | null
          id: string
          net_amount: number
          payment_password_verified: boolean | null
          pix_key: string
          pix_key_type: string
          processed_at: string | null
          requested_at: string | null
          status: string
          tax_amount: number | null
          user_id: string
          wallet_type: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          fee?: number | null
          id?: string
          net_amount: number
          payment_password_verified?: boolean | null
          pix_key: string
          pix_key_type: string
          processed_at?: string | null
          requested_at?: string | null
          status?: string
          tax_amount?: number | null
          user_id: string
          wallet_type?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          fee?: number | null
          id?: string
          net_amount?: number
          payment_password_verified?: boolean | null
          pix_key?: string
          pix_key_type?: string
          processed_at?: string | null
          requested_at?: string | null
          status?: string
          tax_amount?: number | null
          user_id?: string
          wallet_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_daily_task: {
        Args: { _task_id: string; _task_number: number; _user_id: string }
        Returns: Json
      }
      distribute_deposit_commissions: {
        Args: { p_deposit_amount: number; p_user_id: string }
        Returns: undefined
      }
      distribute_vip_commissions: {
        Args: { _payment_id: string; _user_id: string; _vip_plan_id: string }
        Returns: Json
      }
      generate_referral_code_standalone: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      request_withdrawal: {
        Args: {
          _amount: number
          _net_amount: number
          _pix_key: string
          _pix_key_type: string
          _tax_amount: number
          _user_id: string
          _wallet_type: string
        }
        Returns: Json
      }
      test_distribute_vip_commissions: {
        Args: { _user_id: string; _vip_plan_id: string }
        Returns: Json
      }
      validate_referral_code: { Args: { _code: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
