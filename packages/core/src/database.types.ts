export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      binder: {
        Row: {
          id: string
          name: string
          profile_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          profile_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          profile_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "binder_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      coin: {
        Row: {
          acquired_on: string | null
          coin_type_id: number
          grade: Database["public"]["Enums"]["coin_grade"] | null
          id: string
          notes: string | null
          page_id: string | null
          profile_id: string
          slot_column: number | null
          slot_row: number | null
        }
        Insert: {
          acquired_on?: string | null
          coin_type_id: number
          grade?: Database["public"]["Enums"]["coin_grade"] | null
          id?: string
          notes?: string | null
          page_id?: string | null
          profile_id: string
          slot_column?: number | null
          slot_row?: number | null
        }
        Update: {
          acquired_on?: string | null
          coin_type_id?: number
          grade?: Database["public"]["Enums"]["coin_grade"] | null
          id?: string
          notes?: string | null
          page_id?: string | null
          profile_id?: string
          slot_column?: number | null
          slot_row?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coin_coin_type_id_fkey"
            columns: ["coin_type_id"]
            isOneToOne: false
            referencedRelation: "coin_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coin_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "page"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coin_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_type: {
        Row: {
          country_code: string
          face_value_cents: number
          id: number
          variant: string
          year: number
        }
        Insert: {
          country_code: string
          face_value_cents: number
          id?: number
          variant?: string
          year: number
        }
        Update: {
          country_code?: string
          face_value_cents?: number
          id?: number
          variant?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "coin_type_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "country"
            referencedColumns: ["code"]
          },
        ]
      }
      country: {
        Row: {
          circulating: boolean
          code: string
          euro_since: number
        }
        Insert: {
          circulating?: boolean
          code: string
          euro_since: number
        }
        Update: {
          circulating?: boolean
          code?: string
          euro_since?: number
        }
        Relationships: []
      }
      page: {
        Row: {
          binder_id: string
          column_count: number
          id: string
          number: number
          row_count: number
        }
        Insert: {
          binder_id: string
          column_count: number
          id?: string
          number: number
          row_count: number
        }
        Update: {
          binder_id?: string
          column_count?: number
          id?: string
          number?: number
          row_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "page_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "binder"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          created_at: string
          id: string
          nickname: string | null
        }
        Insert: {
          created_at?: string
          id: string
          nickname?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nickname?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      extend_catalog: { Args: { max_year: number }; Returns: undefined }
      place_pair: {
        Args: {
          first_coin: string
          first_column: number
          first_page: string
          first_row: number
          second_coin: string
          second_column: number
          second_page: string
          second_row: number
        }
        Returns: undefined
      }
    }
    Enums: {
      coin_grade:
        | "VERY_FINE"
        | "EXTREMELY_FINE"
        | "ABOUT_UNCIRCULATED"
        | "UNCIRCULATED"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      coin_grade: [
        "VERY_FINE",
        "EXTREMELY_FINE",
        "ABOUT_UNCIRCULATED",
        "UNCIRCULATED",
      ],
    },
  },
} as const

