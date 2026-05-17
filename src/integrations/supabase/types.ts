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
      asaas_webhooks: {
        Row: {
          created_at: string | null
          event_type: string | null
          id: string
          payload: Json | null
          payment_id: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          payment_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          payment_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asaas_webhooks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      notification_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          customer_id: string | null
          error_message: string | null
          id: string
          last_attempt_at: string | null
          max_attempts: number | null
          message: string
          next_attempt_at: string | null
          sent_at: string | null
          status: string | null
          tenant_id: string | null
          type: string
          whatsapp_number: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          customer_id?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number | null
          message: string
          next_attempt_at?: string | null
          sent_at?: string | null
          status?: string | null
          tenant_id?: string | null
          type: string
          whatsapp_number: string
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          customer_id?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number | null
          message?: string
          next_attempt_at?: string | null
          sent_at?: string | null
          status?: string | null
          tenant_id?: string | null
          type?: string
          whatsapp_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_tenant_id_fkey"
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
      plan_payments: {
        Row: {
          amount: number
          asaas_payment_id: string | null
          billing_cycle: string
          created_at: string
          expires_at: string | null
          id: string
          paid_at: string | null
          pix_emv_payload: string | null
          pix_qrcode_image: string | null
          plan_id: string
          raw_webhook: Json | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          asaas_payment_id?: string | null
          billing_cycle: string
          created_at?: string
          expires_at?: string | null
          id?: string
          paid_at?: string | null
          pix_emv_payload?: string | null
          pix_qrcode_image?: string | null
          plan_id: string
          raw_webhook?: Json | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          asaas_payment_id?: string | null
          billing_cycle?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          paid_at?: string | null
          pix_emv_payload?: string | null
          pix_qrcode_image?: string | null
          plan_id?: string
          raw_webhook?: Json | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          features: Json
          id: string
          max_customers: number | null
          name: string
          price_monthly: number
          price_yearly: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          features?: Json
          id: string
          max_customers?: number | null
          name: string
          price_monthly: number
          price_yearly: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          features?: Json
          id?: string
          max_customers?: number | null
          name?: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
        }
        Relationships: []
      }
      tenant_secrets: {
        Row: {
          asaas_api_key: string | null
          asaas_environment: string | null
          asaas_webhook_token: string | null
          evolution_api_key: string | null
          evolution_api_url: string | null
          evolution_instance: string | null
          pix_expiration_minutes: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          asaas_api_key?: string | null
          asaas_environment?: string | null
          asaas_webhook_token?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance?: string | null
          pix_expiration_minutes?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          asaas_api_key?: string | null
          asaas_environment?: string | null
          asaas_webhook_token?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance?: string | null
          pix_expiration_minutes?: number | null
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
          external_webhook_enabled: boolean | null
          external_webhook_secret: string | null
          external_webhook_url: string | null
          id: string
          logo_url: string | null
          max_customers: number | null
          notification_config: Json | null
          notification_settings: Json
          plan: string | null
          plan_expires_at: string | null
          plan_payment_token: string | null
          updated_at: string | null
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          active?: boolean | null
          company_name: string
          created_at?: string | null
          email: string
          external_webhook_enabled?: boolean | null
          external_webhook_secret?: string | null
          external_webhook_url?: string | null
          id?: string
          logo_url?: string | null
          max_customers?: number | null
          notification_config?: Json | null
          notification_settings?: Json
          plan?: string | null
          plan_expires_at?: string | null
          plan_payment_token?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          active?: boolean | null
          company_name?: string
          created_at?: string | null
          email?: string
          external_webhook_enabled?: boolean | null
          external_webhook_secret?: string | null
          external_webhook_url?: string | null
          id?: string
          logo_url?: string | null
          max_customers?: number | null
          notification_config?: Json | null
          notification_settings?: Json
          plan?: string | null
          plan_expires_at?: string | null
          plan_payment_token?: string | null
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
      attach_plan_pix: {
        Args: {
          _asaas_payment_id: string
          _payment_id: string
          _pix_emv: string
          _pix_image: string
        }
        Returns: undefined
      }
      confirm_plan_payment: {
        Args: { _amount: number; _asaas_payment_id: string; _raw: Json }
        Returns: {
          expires_at: string
          plan_id: string
          tenant_company: string
          tenant_id: string
          tenant_whatsapp: string
        }[]
      }
      current_tenant_id: { Args: never; Returns: string }
      expire_overdue_plans: {
        Args: never
        Returns: {
          company_name: string
          previous_plan: string
          tenant_id: string
          whatsapp: string
        }[]
      }
      get_dashboard_metrics: { Args: never; Returns: Json }
      get_expiration_timeline: {
        Args: never
        Returns: {
          count: number
          expiration_date: string
        }[]
      }
      get_my_plan_status: {
        Args: never
        Returns: {
          customer_count: number
          features: Json
          is_expired: boolean
          max_customers: number
          plan_expires_at: string
          plan_id: string
          plan_name: string
          price_monthly: number
          price_yearly: number
          usage_pct: number
        }[]
      }
      get_my_settings: {
        Args: never
        Returns: {
          active: boolean
          asaas_environment: string
          company_name: string
          customer_count: number
          email: string
          evolution_api_url: string
          evolution_instance: string
          has_asaas_key: boolean
          has_evolution_key: boolean
          logo_url: string
          max_customers: number
          notification_settings: Json
          plan: string
          whatsapp: string
          whatsapp_connected_at: string
          whatsapp_status: string
        }[]
      }
      get_plan_payment_status: {
        Args: { _payment_id: string }
        Returns: {
          expires_at: string
          plan_id: string
          status: string
        }[]
      }
      get_public_payment_info: {
        Args: { _token: string }
        Returns: {
          company_name: string
          customer_name: string
          expiration_date: string
          monthly_value: number
          payload_updated_at: string
          pix_emv_payload: string
          pix_expiration_minutes: number
          plan: string
          server_time: string
        }[]
      }
      get_tenant_secrets: {
        Args: { _tenant_id: string }
        Returns: {
          asaas_api_key: string
          asaas_environment: string
          asaas_webhook_token: string
          evolution_api_key: string
          evolution_api_url: string
          evolution_instance: string
          external_webhook_enabled: boolean
          external_webhook_secret: string
          external_webhook_url: string
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
      get_tenants_plan_expiring: {
        Args: { _days?: number }
        Returns: {
          company_name: string
          expires_at: string
          plan_id: string
          plan_name: string
          tenant_id: string
          whatsapp: string
        }[]
      }
      handle_asaas_webhook:
        | { Args: { _payload: Json }; Returns: Json }
        | { Args: { _payload: Json; _tenant_id?: string }; Returns: Json }
      start_plan_checkout: {
        Args: { _billing_cycle: string; _plan_id: string }
        Returns: {
          amount: number
          billing_cycle: string
          payment_id: string
          plan_id: string
          plan_name: string
          plan_payment_token: string
          tenant_id: string
        }[]
      }
      update_my_notification_settings: {
        Args: {
          _confirmed: boolean
          _d0: boolean
          _d1: boolean
          _d3: boolean
          _send_hour: number
        }
        Returns: undefined
      }
      update_tenant_secrets: {
        Args: {
          _asaas_api_key?: string
          _asaas_environment?: string
          _asaas_webhook_token?: string
          _evolution_api_key?: string
          _evolution_api_url?: string
          _pix_expiration_minutes?: number
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
