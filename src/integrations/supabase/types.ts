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
      ai_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          error_log: Json | null
          id: string
          job_dependency: Database["public"]["Enums"]["ai_job_type"] | null
          job_type: Database["public"]["Enums"]["ai_job_type"]
          payload: Json | null
          product_id: string
          result: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["ai_job_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_log?: Json | null
          id?: string
          job_dependency?: Database["public"]["Enums"]["ai_job_type"] | null
          job_type: Database["public"]["Enums"]["ai_job_type"]
          payload?: Json | null
          product_id: string
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ai_job_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_log?: Json | null
          id?: string
          job_dependency?: Database["public"]["Enums"]["ai_job_type"] | null
          job_type?: Database["public"]["Enums"]["ai_job_type"]
          payload?: Json | null
          product_id?: string
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ai_job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_templates: {
        Row: {
          created_at: string
          description_prompt: string
          id: string
          installation_context_id: string
          installed_prompt: string
          studio_prompt: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_prompt: string
          id?: string
          installation_context_id: string
          installed_prompt: string
          studio_prompt: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_prompt?: string
          id?: string
          installation_context_id?: string
          installed_prompt?: string
          studio_prompt?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_templates_installation_context_id_fkey"
            columns: ["installation_context_id"]
            isOneToOne: false
            referencedRelation: "installation_contexts"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          company_address: string | null
          company_email: string | null
          created_at: string
          facebook_url: string | null
          id: string
          instagram_url: string | null
          map_url: string | null
          sales_whatsapp: string | null
          support_whatsapp: string | null
          tiktok_url: string | null
          updated_at: string
        }
        Insert: {
          company_address?: string | null
          company_email?: string | null
          created_at?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          map_url?: string | null
          sales_whatsapp?: string | null
          support_whatsapp?: string | null
          tiktok_url?: string | null
          updated_at?: string
        }
        Update: {
          company_address?: string | null
          company_email?: string | null
          created_at?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          map_url?: string | null
          sales_whatsapp?: string | null
          support_whatsapp?: string | null
          tiktok_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          type_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          type_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items: {
        Row: {
          added_at: string
          collection_id: string
          id: string
          product_id: string
        }
        Insert: {
          added_at?: string
          collection_id: string
          id?: string
          product_id: string
        }
        Update: {
          added_at?: string
          collection_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          inquiry_status: Database["public"]["Enums"]["inquiry_pipeline_status"]
          internal_notes: string | null
          name: string
          updated_at: string
          user_id: string
          whatsapp_sent: boolean
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          inquiry_status?: Database["public"]["Enums"]["inquiry_pipeline_status"]
          internal_notes?: string | null
          name: string
          updated_at?: string
          user_id: string
          whatsapp_sent?: boolean
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          inquiry_status?: Database["public"]["Enums"]["inquiry_pipeline_status"]
          internal_notes?: string | null
          name?: string
          updated_at?: string
          user_id?: string
          whatsapp_sent?: boolean
        }
        Relationships: []
      }
      customer_notes: {
        Row: {
          admin_id: string | null
          created_at: string
          customer_id: string
          id: string
          note: string
          note_type: Database["public"]["Enums"]["customer_note_type"]
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          note: string
          note_type?: Database["public"]["Enums"]["customer_note_type"]
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          note?: string
          note_type?: Database["public"]["Enums"]["customer_note_type"]
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_logs: {
        Row: {
          campaign_id: string
          error: string | null
          id: string
          recipient_email: string | null
          sent_at: string
          status: string
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          error?: string | null
          id?: string
          recipient_email?: string | null
          sent_at?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          error?: string | null
          id?: string
          recipient_email?: string | null
          sent_at?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          banner_url: string | null
          body: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          scheduled_at: string | null
          status: Database["public"]["Enums"]["email_campaign_status"]
          subject: string
          target_segment: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["email_campaign_status"]
          subject: string
          target_segment?: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["email_campaign_status"]
          subject?: string
          target_segment?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_groups: {
        Row: {
          created_at: string
          custom_ai_prompt_override: string | null
          id: string
          name: string
          slug: string
          subcategory_id: string
        }
        Insert: {
          created_at?: string
          custom_ai_prompt_override?: string | null
          id?: string
          name: string
          slug: string
          subcategory_id: string
        }
        Update: {
          created_at?: string
          custom_ai_prompt_override?: string | null
          id?: string
          name?: string
          slug?: string
          subcategory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_groups_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_contexts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["product_asset_type"]
          asset_url: string
          created_at: string
          generated_by_ai: boolean
          generation_version: number
          id: string
          is_primary: boolean
          metadata: Json | null
          product_id: string
        }
        Insert: {
          asset_type: Database["public"]["Enums"]["product_asset_type"]
          asset_url: string
          created_at?: string
          generated_by_ai?: boolean
          generation_version?: number
          id?: string
          is_primary?: boolean
          metadata?: Json | null
          product_id: string
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["product_asset_type"]
          asset_url?: string
          created_at?: string
          generated_by_ai?: boolean
          generation_version?: number
          id?: string
          is_primary?: boolean
          metadata?: Json | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_types: {
        Row: {
          code_prefix: string
          created_at: string
          id: string
          installation_context_id: string
          name: string
          slug: string
        }
        Insert: {
          code_prefix: string
          created_at?: string
          id?: string
          installation_context_id: string
          name: string
          slug: string
        }
        Update: {
          code_prefix?: string
          created_at?: string
          id?: string
          installation_context_id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_types_installation_context_id_fkey"
            columns: ["installation_context_id"]
            isOneToOne: false
            referencedRelation: "installation_contexts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_views: {
        Row: {
          id: string
          product_id: string
          user_id: string | null
          view_timestamp: string
        }
        Insert: {
          id?: string
          product_id: string
          user_id?: string | null
          view_timestamp?: string
        }
        Update: {
          id?: string
          product_id?: string
          user_id?: string | null
          view_timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_views_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          ai_status: Database["public"]["Enums"]["ai_asset_status"]
          ai_understanding: Json | null
          alt_text: string | null
          app_keywords: string[] | null
          app_search_keywords: string[] | null
          brand: string | null
          canonical_slug: string | null
          category_id: string | null
          code: string
          color: string | null
          created_at: string
          deleted_at: string | null
          error_log: Json | null
          family_id: string | null
          featured_feed: boolean
          featured_homepage: boolean
          finish: string | null
          finish_name: string | null
          generated_description: string | null
          generated_installed_image: string | null
          generated_studio_image: string | null
          generation_hash: string | null
          generation_version: number
          hidden: boolean
          id: string
          image_url: string | null
          installation_context_id: string | null
          is_ai_processing: boolean
          is_published: boolean
          last_processed_at: string | null
          material: string | null
          name: string
          price: number
          processing_state: Database["public"]["Enums"]["product_processing_state"]
          production_name: string | null
          retry_count: number
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
          short_description: string | null
          similar_product_ids: string[]
          size: string | null
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          stock_quantity: number
          subcategory_id: string | null
          type_id: string | null
          updated_at: string
        }
        Insert: {
          ai_status?: Database["public"]["Enums"]["ai_asset_status"]
          ai_understanding?: Json | null
          alt_text?: string | null
          app_keywords?: string[] | null
          app_search_keywords?: string[] | null
          brand?: string | null
          canonical_slug?: string | null
          category_id?: string | null
          code: string
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          error_log?: Json | null
          family_id?: string | null
          featured_feed?: boolean
          featured_homepage?: boolean
          finish?: string | null
          finish_name?: string | null
          generated_description?: string | null
          generated_installed_image?: string | null
          generated_studio_image?: string | null
          generation_hash?: string | null
          generation_version?: number
          hidden?: boolean
          id?: string
          image_url?: string | null
          installation_context_id?: string | null
          is_ai_processing?: boolean
          is_published?: boolean
          last_processed_at?: string | null
          material?: string | null
          name: string
          price?: number
          processing_state?: Database["public"]["Enums"]["product_processing_state"]
          production_name?: string | null
          retry_count?: number
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          short_description?: string | null
          similar_product_ids?: string[]
          size?: string | null
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          subcategory_id?: string | null
          type_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_status?: Database["public"]["Enums"]["ai_asset_status"]
          ai_understanding?: Json | null
          alt_text?: string | null
          app_keywords?: string[] | null
          app_search_keywords?: string[] | null
          brand?: string | null
          canonical_slug?: string | null
          category_id?: string | null
          code?: string
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          error_log?: Json | null
          family_id?: string | null
          featured_feed?: boolean
          featured_homepage?: boolean
          finish?: string | null
          finish_name?: string | null
          generated_description?: string | null
          generated_installed_image?: string | null
          generated_studio_image?: string | null
          generation_hash?: string | null
          generation_version?: number
          hidden?: boolean
          id?: string
          image_url?: string | null
          installation_context_id?: string | null
          is_ai_processing?: boolean
          is_published?: boolean
          last_processed_at?: string | null
          material?: string | null
          name?: string
          price?: number
          processing_state?: Database["public"]["Enums"]["product_processing_state"]
          production_name?: string | null
          retry_count?: number
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          short_description?: string | null
          similar_product_ids?: string[]
          size?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          subcategory_id?: string | null
          type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_installation_context_id_fkey"
            columns: ["installation_context_id"]
            isOneToOne: false
            referencedRelation: "installation_contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_id: string
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          tags: string[]
          vip_status: boolean
        }
        Insert: {
          auth_id: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          tags?: string[]
          vip_status?: boolean
        }
        Update: {
          auth_id?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          tags?: string[]
          vip_status?: boolean
        }
        Relationships: []
      }
      search_index: {
        Row: {
          combined_search_text: string
          master_document: Json
          normalized_size: string | null
          product_id: string
          search_aliases: string[]
          search_vector: unknown
          updated_at: string
        }
        Insert: {
          combined_search_text?: string
          master_document?: Json
          normalized_size?: string | null
          product_id: string
          search_aliases?: string[]
          search_vector?: unknown
          updated_at?: string
        }
        Update: {
          combined_search_text?: string
          master_document?: Json
          normalized_size?: string | null
          product_id?: string
          search_aliases?: string[]
          search_vector?: unknown
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_index_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_inquiries: {
        Row: {
          assigned_admin_id: string | null
          collection_id: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          id: string
          inquiry_status: Database["public"]["Enums"]["inquiry_pipeline_status"]
          internal_notes: string | null
          last_contacted_at: string | null
          status: string
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          assigned_admin_id?: string | null
          collection_id: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          id?: string
          inquiry_status?: Database["public"]["Enums"]["inquiry_pipeline_status"]
          internal_notes?: string | null
          last_contacted_at?: string | null
          status?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          assigned_admin_id?: string | null
          collection_id?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          inquiry_status?: Database["public"]["Enums"]["inquiry_pipeline_status"]
          internal_notes?: string | null
          last_contacted_at?: string | null
          status?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inquiries_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_product_hash: {
        Args: {
          _category_id: string
          _finish: string
          _manufacturer: string
          _size: string
          _type_id: string
        }
        Returns: string
      }
      enqueue_ai_pipeline: { Args: { _product_id: string }; Returns: undefined }
      generate_product_code: { Args: { _type_id: string }; Returns: string }
      generate_size_aliases: { Args: { _size: string }; Returns: string[] }
      get_my_roles: { Args: never; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      rebuild_search_index: {
        Args: { _product_id: string }
        Returns: undefined
      }
      recompute_similar_products: {
        Args: { _product_id: string }
        Returns: undefined
      }
      retry_ai_job: { Args: { _job_id: string }; Returns: undefined }
    }
    Enums: {
      account_status: "ACTIVE" | "SUSPENDED" | "BLOCKED"
      ai_asset_status: "idle" | "queued" | "processing" | "ready" | "failed"
      ai_job_status: "pending" | "processing" | "success" | "failed" | "retry"
      ai_job_type:
        | "understanding"
        | "search_index"
        | "seo"
        | "description"
        | "image_generation"
        | "faq_generation"
      app_role: "admin" | "user" | "customer" | "super_admin"
      customer_note_type: "GENERAL" | "SALES" | "SUPPORT" | "VIP" | "FOLLOW_UP"
      email_campaign_status:
        | "DRAFT"
        | "READY"
        | "SENDING"
        | "SENT"
        | "FAILED"
        | "ARCHIVED"
      inquiry_pipeline_status:
        | "NEW"
        | "CONTACTED"
        | "NEGOTIATING"
        | "QUOTED"
        | "CLOSED"
        | "LOST"
      product_asset_type: "original" | "studio" | "installed" | "gallery"
      product_processing_state:
        | "draft"
        | "pending"
        | "processing"
        | "completed"
        | "error"
        | "archived"
      product_status: "draft" | "review" | "published" | "archived"
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
      account_status: ["ACTIVE", "SUSPENDED", "BLOCKED"],
      ai_asset_status: ["idle", "queued", "processing", "ready", "failed"],
      ai_job_status: ["pending", "processing", "success", "failed", "retry"],
      ai_job_type: [
        "understanding",
        "search_index",
        "seo",
        "description",
        "image_generation",
        "faq_generation",
      ],
      app_role: ["admin", "user", "customer", "super_admin"],
      customer_note_type: ["GENERAL", "SALES", "SUPPORT", "VIP", "FOLLOW_UP"],
      email_campaign_status: [
        "DRAFT",
        "READY",
        "SENDING",
        "SENT",
        "FAILED",
        "ARCHIVED",
      ],
      inquiry_pipeline_status: [
        "NEW",
        "CONTACTED",
        "NEGOTIATING",
        "QUOTED",
        "CLOSED",
        "LOST",
      ],
      product_asset_type: ["original", "studio", "installed", "gallery"],
      product_processing_state: [
        "draft",
        "pending",
        "processing",
        "completed",
        "error",
        "archived",
      ],
      product_status: ["draft", "review", "published", "archived"],
    },
  },
} as const
