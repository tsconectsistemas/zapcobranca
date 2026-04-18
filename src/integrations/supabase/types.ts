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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          created_at: string | null
          expiration_date: string | null
          id: string
          iptv_created_at: string | null
          last_access: string | null
          monthly_value: number | null
          name: string | null
          notes: string | null
          password_iptv: string | null
          payment_token: string | null
          pix_emv_payload: string | null
          plan: string | null
          reseller_tag: string | null
          screens: number | null
          status: string | null
          tenant_id: string
          updated_at: string | null
          username: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string | null
          expiration_date?: string | null
          id?: string
          iptv_created_at?: string | null
          last_access?: string | null
          monthly_value?: number | null
          name?: string | null
          notes?: string | null
          password_iptv?: string | null
          payment_token?: string | null
          pix_emv_payload?: string | null
          plan?: string | null
          reseller_tag?: string | null
          screens?: number | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
          username: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string | null
          expiration_date?: string | null
          id?: string
          iptv_created_at?: string | null
          last_access?: string | null
          monthly_value?: number | null
          name?: string | null
          notes?: string | null
          password_iptv?: string | null
          payment_token?: string | null
          pix_emv_payload?: string | null
          plan?: string | null
          reseller_tag?: string | null
          screens?: number | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
          username?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          customer_id: string
          error_message: string | null
          id: string
          message: string | null
          sent_at: string | null
          success: boolean | null
          tenant_id: string
          type: string
          whatsapp_number: string | null
        }
        Insert: {
          customer_id: string
          error_message?: string | null
          id?: string
          message?: string | null
          sent_at?: string | null
          success?: boolean | null
          tenant_id: string
          type: string
          whatsapp_number?: string | null
        }
        Update: {
          customer_id?: string
          error_message?: string | null
          id?: string
          message?: string | null
          sent_at?: string | null
          success?: boolean | null
          tenant_id?: string
          type?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number | null
          asaas_payment_id: string | null
          asaas_pix_key: string | null
          created_at: string | null
          customer_id: string
          id: string
          new_expiration: string | null
          paid_at: string | null
          previous_expiration: string | null
          raw_webhook: Json | null
          tenant_id: string
        }
        Insert: {
          amount?: number | null
          asaas_payment_id?: string | null
          asaas_pix_key?: string | null
          created_at?: string | null
          customer_id: string
          id?: string
          new_expiration?: string | null
          paid_at?: string | null
          previous_expiration?: string | null
          raw_webhook?: Json | null
          tenant_id: string
        }
        Update: {
          amount?: number | null
          asaas_payment_id?: string | null
          asaas_pix_key?: string | null
          created_at?: string | null
          customer_id?: string
          id?: string
          new_expiration?: string | null
          paid_at?: string | null
          previous_expiration?: string | null
          raw_webhook?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_secrets: {
        Row: {
          asaas_api_key: string | null
          asaas_environment: string | null
          evolution_api_key: string | null
          evolution_api_url: string | null
          evolution_instance: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          asaas_api_key?: string | null
          asaas_environment?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          asaas_api_key?: string | null
          asaas_environment?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_secrets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          active: boolean | null
          company_name: string
          created_at: string | null
          email: string
          id: string
          max_customers: number | null
          plan: string | null
          updated_at: string | null
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          active?: boolean | null
          company_name: string
          created_at?: string | null
          email: string
          id?: string
          max_customers?: number | null
          plan?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          active?: boolean | null
          company_name?: string
          created_at?: string | null
          email?: string
          id?: string
          max_customers?: number | null
          plan?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      whatsapp_sessions: {
        Row: {
          connected_at: string | null
          id: string
          instance_name: string | null
          qr_code: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          connected_at?: string | null
          id?: string
          instance_name?: string | null
          qr_code?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          connected_at?: string | null
          id?: string
          instance_name?: string | null
          qr_code?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_tenant_id: { Args: never; Returns: string }
      get_public_payment_info: {
        Args: { _token: string }
        Returns: {
          company_name: string
          customer_name: string
          expiration_date: string
          monthly_value: number
          pix_emv_payload: string
          plan: string
        }[]
      }
      get_tenant_secrets: {
        Args: { _tenant_id: string }
        Returns: {
          asaas_api_key: string
          asaas_environment: string
          evolution_api_key: string
          evolution_api_url: string
          evolution_instance: string
        }[]
      }
      get_tenant_secrets_status: {
        Args: never
        Returns: {
          asaas_environment: string
          has_asaas_key: boolean
          has_evolution_instance: boolean
          has_evolution_key: boolean
          has_evolution_url: boolean
        }[]
      }
      update_tenant_secrets: {
        Args: {
          _asaas_api_key?: string
          _asaas_environment?: string
          _evolution_api_key?: string
          _evolution_api_url?: string
          _evolution_instance?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
