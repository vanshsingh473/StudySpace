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
      bookings: {
        Row: {
          booking_code: string
          cancelled_at: string | null
          created_at: string
          date: string
          id: number
          period_id: number
          room_id: number
          seat_id: number
          status: string
          student_id: number
        }
        Insert: {
          booking_code?: string
          cancelled_at?: string | null
          created_at?: string
          date: string
          id?: number
          period_id: number
          room_id: number
          seat_id: number
          status?: string
          student_id: number
        }
        Update: {
          booking_code?: string
          cancelled_at?: string | null
          created_at?: string
          date?: string
          id?: number
          period_id?: number
          room_id?: number
          seat_id?: number
          status?: string
          student_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "bookings_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          id: number
          message: string
          page: string
        }
        Insert: {
          created_at?: string
          id?: never
          message: string
          page?: string
        }
        Update: {
          created_at?: string
          id?: never
          message?: string
          page?: string
        }
        Relationships: []
      }
      periods: {
        Row: {
          end_time: string
          id: number
          is_break: boolean
          name: string
          sort_order: number
          start_time: string
        }
        Insert: {
          end_time: string
          id?: number
          is_break?: boolean
          name: string
          sort_order?: number
          start_time: string
        }
        Update: {
          end_time?: string
          id?: number
          is_break?: boolean
          name?: string
          sort_order?: number
          start_time?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      room_blocks: {
        Row: {
          id: number
          period_id: number
          reason: string
          room_id: number
          weekday: number
        }
        Insert: {
          id?: number
          period_id: number
          reason?: string
          room_id: number
          weekday: number
        }
        Update: {
          id?: number
          period_id?: number
          reason?: string
          room_id?: number
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_blocks_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_blocks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          id: number
          is_active: boolean
          location_note: string
          name: string
          total_seats: number
          type: string
        }
        Insert: {
          id?: number
          is_active?: boolean
          location_note?: string
          name: string
          total_seats?: number
          type: string
        }
        Update: {
          id?: number
          is_active?: boolean
          location_note?: string
          name?: string
          total_seats?: number
          type?: string
        }
        Relationships: []
      }
      seats: {
        Row: {
          id: number
          is_active: boolean
          label: string
          room_id: number
        }
        Insert: {
          id?: number
          is_active?: boolean
          label: string
          room_id: number
        }
        Update: {
          id?: number
          is_active?: boolean
          label?: string
          room_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "seats_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          expires_at: string
          is_admin: boolean
          student_id: number | null
          token: string
        }
        Insert: {
          expires_at: string
          is_admin?: boolean
          student_id?: number | null
          token: string
        }
        Update: {
          expires_at?: string
          is_admin?: boolean
          student_id?: number | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          class_label: string
          created_at: string
          email: string | null
          id: number
          name: string
          roll_no: string
          user_id: string | null
        }
        Insert: {
          class_label: string
          created_at?: string
          email?: string | null
          id?: number
          name: string
          roll_no: string
          user_id?: string | null
        }
        Update: {
          class_label?: string
          created_at?: string
          email?: string | null
          id?: number
          name?: string
          roll_no?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      book_seat: {
        Args: {
          p_period_id: number
          p_room_id: number
          p_seat_id: number
          p_student_id: number
        }
        Returns: Json
      }
      cancel_booking: {
        Args: { p_booking_id: number; p_student_id: number }
        Returns: Json
      }
      create_admin_session: { Args: never; Returns: string }
      current_period_info: { Args: never; Returns: Json }
      expire_bookings: { Args: never; Returns: undefined }
      get_availability: {
        Args: { p_date: string; p_period_id: number }
        Returns: Json
      }
      get_room_seats: {
        Args: { p_date: string; p_period_id: number; p_room_id: number }
        Returns: Json
      }
      hit_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_secs: number }
        Returns: boolean
      }
      ist_now: { Args: never; Returns: string }
      set_room_seats: {
        Args: { p_count: number; p_room_id: number }
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
    Enums: {},
  },
} as const
