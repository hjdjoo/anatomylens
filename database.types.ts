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
      exercise_suggestions: {
        Row: {
          contributor_name: string | null
          created_at: string | null
          description: string | null
          difficulty: number
          downvotes: number
          equipment: string[] | null
          id: string
          name: string
          promoted_at: string | null
          promoted_exercise_id: string | null
          rejection_reason: string | null
          status: string
          suggested_by: string
          updated_at: string | null
          upvotes: number
          video_url: string | null
        }
        Insert: {
          contributor_name?: string | null
          created_at?: string | null
          description?: string | null
          difficulty: number
          downvotes?: number
          equipment?: string[] | null
          id?: string
          name: string
          promoted_at?: string | null
          promoted_exercise_id?: string | null
          rejection_reason?: string | null
          status?: string
          suggested_by: string
          updated_at?: string | null
          upvotes?: number
          video_url?: string | null
        }
        Update: {
          contributor_name?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: number
          downvotes?: number
          equipment?: string[] | null
          id?: string
          name?: string
          promoted_at?: string | null
          promoted_exercise_id?: string | null
          rejection_reason?: string | null
          status?: string
          suggested_by?: string
          updated_at?: string | null
          upvotes?: number
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_suggestions_promoted_exercise_id_fkey"
            columns: ["promoted_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          category: string | null
          common_mistakes: string[] | null
          contributed_by: string | null
          contributor_name: string | null
          created_at: string | null
          cues: string[] | null
          description: string | null
          difficulty: number
          equipment: string[] | null
          id: string
          instructions: string | null
          movement_pattern: string | null
          name: string
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          source_url: string | null
          status: string | null
          thumbnail_url: string | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          category?: string | null
          common_mistakes?: string[] | null
          contributed_by?: string | null
          contributor_name?: string | null
          created_at?: string | null
          cues?: string[] | null
          description?: string | null
          difficulty: number
          equipment?: string[] | null
          id?: string
          instructions?: string | null
          movement_pattern?: string | null
          name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          source_url?: string | null
          status?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          category?: string | null
          common_mistakes?: string[] | null
          contributed_by?: string | null
          contributor_name?: string | null
          created_at?: string | null
          cues?: string[] | null
          description?: string | null
          difficulty?: number
          equipment?: string[] | null
          id?: string
          instructions?: string | null
          movement_pattern?: string | null
          name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          source_url?: string | null
          status?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      structure_details: {
        Row: {
          actions: string[] | null
          articulations: string | null
          attachments: Json | null
          created_at: string | null
          description: string | null
          id: string
          innervation: string | null
          source: string[] | null
          structure_id: string
          summary: string | null
          updated_at: string | null
        }
        Insert: {
          actions?: string[] | null
          articulations?: string | null
          attachments?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          innervation?: string | null
          source?: string[] | null
          structure_id: string
          summary?: string | null
          updated_at?: string | null
        }
        Update: {
          actions?: string[] | null
          articulations?: string | null
          attachments?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          innervation?: string | null
          source?: string[] | null
          structure_id?: string
          summary?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "structure_details_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: true
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      structure_exercises: {
        Row: {
          contributed_by: string | null
          created_at: string | null
          exercise_id: string
          id: string
          involvement: string
          notes: string | null
          status: string | null
          structure_id: string
        }
        Insert: {
          contributed_by?: string | null
          created_at?: string | null
          exercise_id: string
          id?: string
          involvement: string
          notes?: string | null
          status?: string | null
          structure_id: string
        }
        Update: {
          contributed_by?: string | null
          created_at?: string | null
          exercise_id?: string
          id?: string
          involvement?: string
          notes?: string | null
          status?: string | null
          structure_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "structure_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structure_exercises_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      structures: {
        Row: {
          created_at: string | null
          id: string
          layer: number
          mesh_id: string
          original_name: string
          region: string
          side: string | null
          summary: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          layer: number
          mesh_id: string
          original_name: string
          region: string
          side?: string | null
          summary?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          layer?: number
          mesh_id?: string
          original_name?: string
          region?: string
          side?: string | null
          summary?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      suggestion_structures: {
        Row: {
          created_at: string | null
          id: string
          involvement: string
          notes: string | null
          structure_id: string
          suggestion_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          involvement: string
          notes?: string | null
          structure_id: string
          suggestion_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          involvement?: string
          notes?: string | null
          structure_id?: string
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_structures_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_structures_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "exercise_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_votes: {
        Row: {
          created_at: string | null
          suggestion_id: string
          updated_at: string | null
          user_id: string
          vote: number
        }
        Insert: {
          created_at?: string | null
          suggestion_id: string
          updated_at?: string | null
          user_id: string
          vote: number
        }
        Update: {
          created_at?: string | null
          suggestion_id?: string
          updated_at?: string | null
          user_id?: string
          vote?: number
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "exercise_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_exercises: {
        Row: {
          added_at: string | null
          exercise_id: string
          folder_id: string | null
          id: string
          notes: string | null
          reps: number | null
          rest_seconds: number | null
          sets: number | null
          sort_order: number | null
          updated_at: string | null
          user_id: string
          weight: number | null
        }
        Insert: {
          added_at?: string | null
          exercise_id: string
          folder_id?: string | null
          id?: string
          notes?: string | null
          reps?: number | null
          rest_seconds?: number | null
          sets?: number | null
          sort_order?: number | null
          updated_at?: string | null
          user_id: string
          weight?: number | null
        }
        Update: {
          added_at?: string | null
          exercise_id?: string
          folder_id?: string | null
          id?: string
          notes?: string | null
          reps?: number | null
          rest_seconds?: number | null
          sets?: number | null
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          contributions_accepted: number | null
          created_at: string | null
          display_name: string | null
          exercises_contributed: number | null
          id: string
          stripe_customer_id: string | null
          subscription_ends_at: string | null
          subscription_id: string | null
          subscription_status: string | null
          tier: number
          updated_at: string | null
          weight_unit: string | null
        }
        Insert: {
          avatar_url?: string | null
          contributions_accepted?: number | null
          created_at?: string | null
          display_name?: string | null
          exercises_contributed?: number | null
          id: string
          stripe_customer_id?: string | null
          subscription_ends_at?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          tier?: number
          updated_at?: string | null
          weight_unit?: string | null
        }
        Update: {
          avatar_url?: string | null
          contributions_accepted?: number | null
          created_at?: string | null
          display_name?: string | null
          exercises_contributed?: number | null
          id?: string
          stripe_customer_id?: string | null
          subscription_ends_at?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          tier?: number
          updated_at?: string | null
          weight_unit?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_suggestion_rate_limit: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      get_structure_suggestions: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_structure_id: string
          p_user_id: string
        }
        Returns: {
          contributor_name: string
          created_at: string
          description: string
          difficulty: number
          downvotes: number
          equipment: string[]
          id: string
          involvement: string
          name: string
          suggested_by: string
          upvotes: number
          user_vote: number
          video_url: string
          vote_ratio: number
        }[]
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
