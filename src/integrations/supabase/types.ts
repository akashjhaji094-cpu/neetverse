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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      adaptive_learning_sessions: {
        Row: {
          answers: Json
          chapter_id: string | null
          completed_at: string | null
          created_at: string | null
          current_question_index: number
          id: string
          mode: string
          questions: Json
          skill_snapshots: Json
          started_at: string | null
          status: string
          subject_id: string
          target_skill_level: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          answers?: Json
          chapter_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_question_index?: number
          id?: string
          mode?: string
          questions?: Json
          skill_snapshots?: Json
          started_at?: string | null
          status?: string
          subject_id: string
          target_skill_level?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          answers?: Json
          chapter_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_question_index?: number
          id?: string
          mode?: string
          questions?: Json
          skill_snapshots?: Json
          started_at?: string | null
          status?: string
          subject_id?: string
          target_skill_level?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adaptive_learning_sessions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adaptive_learning_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      adaptive_question_pools: {
        Row: {
          chapter_id: string
          difficulty_bucket: string
          id: string
          question_ids: string[]
          total_count: number
          updated_at: string | null
        }
        Insert: {
          chapter_id: string
          difficulty_bucket: string
          id?: string
          question_ids?: string[]
          total_count?: number
          updated_at?: string | null
        }
        Update: {
          chapter_id?: string
          difficulty_bucket?: string
          id?: string
          question_ids?: string[]
          total_count?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adaptive_question_pools_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_broadcasts: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_uploads: {
        Row: {
          admin_id: string
          created_at: string
          errors: Json | null
          filename: string
          id: string
          parsed_data: Json | null
          status: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          errors?: Json | null
          filename: string
          id?: string
          parsed_data?: Json | null
          status?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          errors?: Json | null
          filename?: string
          id?: string
          parsed_data?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_uploads_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_answers: {
        Row: {
          attempt_id: string
          chosen_option_index: number | null
          created_at: string
          id: string
          is_correct: boolean | null
          question_id: string
          time_taken_seconds: number | null
        }
        Insert: {
          attempt_id: string
          chosen_option_index?: number | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_id: string
          time_taken_seconds?: number | null
        }
        Update: {
          attempt_id?: string
          chosen_option_index?: number | null
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_id?: string
          time_taken_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          config: Json | null
          details: Json | null
          finished_at: string | null
          id: string
          omr_image_path: string | null
          omr_status: string
          question_ids: string[] | null
          score: number | null
          started_at: string
          type: Database["public"]["Enums"]["attempt_type"]
          user_id: string
        }
        Insert: {
          config?: Json | null
          details?: Json | null
          finished_at?: string | null
          id?: string
          omr_image_path?: string | null
          omr_status?: string
          question_ids?: string[] | null
          score?: number | null
          started_at?: string
          type: Database["public"]["Enums"]["attempt_type"]
          user_id: string
        }
        Update: {
          config?: Json | null
          details?: Json | null
          finished_at?: string | null
          id?: string
          omr_image_path?: string | null
          omr_status?: string
          question_ids?: string[] | null
          score?: number | null
          started_at?: string
          type?: Database["public"]["Enums"]["attempt_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_history: {
        Row: {
          chapter_name: string | null
          correct_count: number
          display_name: string
          final_rank: number
          id: string
          max_streak: number
          new_rating: number
          played_at: string | null
          rating_change: number
          room_id: string
          score: number
          subject_name: string | null
          user_id: string
          wrong_count: number
        }
        Insert: {
          chapter_name?: string | null
          correct_count: number
          display_name: string
          final_rank: number
          id?: string
          max_streak: number
          new_rating: number
          played_at?: string | null
          rating_change?: number
          room_id: string
          score: number
          subject_name?: string | null
          user_id: string
          wrong_count: number
        }
        Update: {
          chapter_name?: string | null
          correct_count?: number
          display_name?: string
          final_rank?: number
          id?: string
          max_streak?: number
          new_rating?: number
          played_at?: string | null
          rating_change?: number
          room_id?: string
          score?: number
          subject_name?: string | null
          user_id?: string
          wrong_count?: number
        }
        Relationships: []
      }
      battle_leaderboard: {
        Row: {
          avg_score: number
          best_streak: number
          created_at: string | null
          display_name: string
          id: string
          rank_tier: string
          rating: number
          total_battles: number
          total_score: number
          total_wins: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_score?: number
          best_streak?: number
          created_at?: string | null
          display_name: string
          id?: string
          rank_tier?: string
          rating?: number
          total_battles?: number
          total_score?: number
          total_wins?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_score?: number
          best_streak?: number
          created_at?: string | null
          display_name?: string
          id?: string
          rank_tier?: string
          rating?: number
          total_battles?: number
          total_score?: number
          total_wins?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      battle_players: {
        Row: {
          answers: Json
          avatar_emoji: string | null
          correct_count: number
          display_name: string
          id: string
          is_connected: boolean
          is_host: boolean
          is_ready: boolean
          joined_at: string | null
          last_ping_at: string | null
          max_streak: number
          room_id: string
          score: number
          streak: number
          user_id: string
          wrong_count: number
        }
        Insert: {
          answers?: Json
          avatar_emoji?: string | null
          correct_count?: number
          display_name: string
          id?: string
          is_connected?: boolean
          is_host?: boolean
          is_ready?: boolean
          joined_at?: string | null
          last_ping_at?: string | null
          max_streak?: number
          room_id: string
          score?: number
          streak?: number
          user_id: string
          wrong_count?: number
        }
        Update: {
          answers?: Json
          avatar_emoji?: string | null
          correct_count?: number
          display_name?: string
          id?: string
          is_connected?: boolean
          is_host?: boolean
          is_ready?: boolean
          joined_at?: string | null
          last_ping_at?: string | null
          max_streak?: number
          room_id?: string
          score?: number
          streak?: number
          user_id?: string
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "battle_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "battle_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_question_states: {
        Row: {
          created_at: string | null
          ends_at: string | null
          id: string
          player_answers: Json
          question_id: string
          question_index: number
          room_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          ends_at?: string | null
          id?: string
          player_answers?: Json
          question_id: string
          question_index: number
          room_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          ends_at?: string | null
          id?: string
          player_answers?: Json
          question_id?: string
          question_index?: number
          room_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_question_states_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "battle_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_room_questions: {
        Row: {
          created_at: string
          id: string
          question_id: string
          question_index: number
          room_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          question_index: number
          room_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          question_index?: number
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_room_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_room_questions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "battle_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_rooms: {
        Row: {
          chapter_id: string | null
          code: string
          created_at: string | null
          current_players: number
          current_question_index: number
          finished_at: string | null
          host_id: string
          id: string
          max_players: number
          name: string
          question_count: number
          questions: Json
          started_at: string | null
          status: string
          subject_id: string | null
          time_per_question: number
          updated_at: string | null
        }
        Insert: {
          chapter_id?: string | null
          code: string
          created_at?: string | null
          current_players?: number
          current_question_index?: number
          finished_at?: string | null
          host_id: string
          id?: string
          max_players?: number
          name?: string
          question_count?: number
          questions?: Json
          started_at?: string | null
          status?: string
          subject_id?: string | null
          time_per_question?: number
          updated_at?: string | null
        }
        Update: {
          chapter_id?: string | null
          code?: string
          created_at?: string | null
          current_players?: number
          current_question_index?: number
          finished_at?: string | null
          host_id?: string
          id?: string
          max_players?: number
          name?: string
          question_count?: number
          questions?: Json
          started_at?: string | null
          status?: string
          subject_id?: string | null
          time_per_question?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "battle_rooms_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_rooms_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          created_at: string
          id: string
          meta: Json | null
          name: string
          slug: string
          subject_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json | null
          name: string
          slug: string
          subject_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json | null
          name?: string
          slug?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_study_plans: {
        Row: {
          completed_count: number
          completed_tasks: Json
          created_at: string | null
          date: string
          id: string
          plan: Json
          study_time_minutes: number
          total_tasks: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_count?: number
          completed_tasks?: Json
          created_at?: string | null
          date?: string
          id?: string
          plan?: Json
          study_time_minutes?: number
          total_tasks?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_count?: number
          completed_tasks?: Json
          created_at?: string | null
          date?: string
          id?: string
          plan?: Json
          study_time_minutes?: number
          total_tasks?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          email: string
          error_message: string | null
          id: string
          sent_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          audience_filter: Json | null
          audience_type: string
          blocks: Json
          created_at: string
          failed_count: number
          id: string
          provider_used: string | null
          scheduled_at: string | null
          sent_at: string | null
          sent_by: string | null
          sent_count: number
          status: string
          subject: string
          title: string
          total_recipients: number
          trigger_type: string
          updated_at: string
        }
        Insert: {
          audience_filter?: Json | null
          audience_type?: string
          blocks?: Json
          created_at?: string
          failed_count?: number
          id?: string
          provider_used?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sent_count?: number
          status?: string
          subject: string
          title: string
          total_recipients?: number
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          audience_filter?: Json | null
          audience_type?: string
          blocks?: Json
          created_at?: string
          failed_count?: number
          id?: string
          provider_used?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sent_count?: number
          status?: string
          subject?: string
          title?: string
          total_recipients?: number
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          blocks: Json
          created_at: string
          created_by: string | null
          id: string
          is_builtin: boolean
          name: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_builtin?: boolean
          name: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_builtin?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      in_progress_tests: {
        Row: {
          answers: Json
          config: Json
          current_question_index: number
          id: string
          question_ids: string[]
          started_at: string
          test_type: string
          total_questions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          config?: Json
          current_question_index?: number
          id?: string
          question_ids?: string[]
          started_at?: string
          test_type?: string
          total_questions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          config?: Json
          current_question_index?: number
          id?: string
          question_ids?: string[]
          started_at?: string
          test_type?: string
          total_questions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_paths: {
        Row: {
          chapters_order: string[]
          created_at: string | null
          daily_targets: Json
          description: string | null
          difficulty_level: string
          duration_days: number
          id: string
          is_premium: boolean
          subject_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          chapters_order?: string[]
          created_at?: string | null
          daily_targets?: Json
          description?: string | null
          difficulty_level?: string
          duration_days?: number
          id?: string
          is_premium?: boolean
          subject_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          chapters_order?: string[]
          created_at?: string | null
          daily_targets?: Json
          description?: string | null
          difficulty_level?: string
          duration_days?: number
          id?: string
          is_premium?: boolean
          subject_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_paths_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          chapter_id: string | null
          created_at: string
          drive_link: string | null
          file_url: string | null
          id: string
          subject_id: string | null
          title: string
          uploaded_by: string | null
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          drive_link?: string | null
          file_url?: string | null
          id?: string
          subject_id?: string | null
          title: string
          uploaded_by?: string | null
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          drive_link?: string | null
          file_url?: string | null
          id?: string
          subject_id?: string | null
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_access_keys: {
        Row: {
          access_key: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          user_id: string
        }
        Insert: {
          access_key: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          user_id: string
        }
        Update: {
          access_key?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          user_id?: string
        }
        Relationships: []
      }
      premium_planners: {
        Row: {
          created_at: string
          file_url: string
          id: string
          title: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          title: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          title?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      premium_tests: {
        Row: {
          access_key: string | null
          created_at: string
          description: string | null
          file_url: string
          id: string
          title: string
          uploaded_by: string
        }
        Insert: {
          access_key?: string | null
          created_at?: string
          description?: string | null
          file_url: string
          id?: string
          title: string
          uploaded_by: string
        }
        Update: {
          access_key?: string | null
          created_at?: string
          description?: string | null
          file_url?: string
          id?: string
          title?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          referral_code: string | null
          referred_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
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
      pyq_attempts: {
        Row: {
          answers: Json
          chapter_id: string
          correct_count: number
          created_at: string
          id: string
          paper_id: string | null
          score: number
          subject_id: string | null
          time_taken_seconds: number | null
          total_questions: number
          unattempted_count: number
          updated_at: string
          user_id: string
          wrong_count: number
        }
        Insert: {
          answers?: Json
          chapter_id: string
          correct_count?: number
          created_at?: string
          id?: string
          paper_id?: string | null
          score?: number
          subject_id?: string | null
          time_taken_seconds?: number | null
          total_questions?: number
          unattempted_count?: number
          updated_at?: string
          user_id: string
          wrong_count?: number
        }
        Update: {
          answers?: Json
          chapter_id?: string
          correct_count?: number
          created_at?: string
          id?: string
          paper_id?: string | null
          score?: number
          subject_id?: string | null
          time_taken_seconds?: number | null
          total_questions?: number
          unattempted_count?: number
          updated_at?: string
          user_id?: string
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "pyq_attempts_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyq_attempts_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "pyq_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pyq_attempts_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      pyq_papers: {
        Row: {
          chapter_id: string
          created_at: string
          id: string
          paper_pdf_url: string | null
          solution_pdf_url: string | null
          subject_id: string | null
          title: string
          total_questions: number
          uploaded_by: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          id?: string
          paper_pdf_url?: string | null
          solution_pdf_url?: string | null
          subject_id?: string | null
          title: string
          total_questions?: number
          uploaded_by: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          id?: string
          paper_pdf_url?: string | null
          solution_pdf_url?: string | null
          subject_id?: string | null
          title?: string
          total_questions?: number
          uploaded_by?: string
        }
        Relationships: []
      }
      pyq_questions: {
        Row: {
          chapter_id: string
          correct_option_index: number
          created_at: string
          id: string
          image_url: string
          page_number: number
          paper_id: string
          subject_id: string | null
        }
        Insert: {
          chapter_id: string
          correct_option_index: number
          created_at?: string
          id?: string
          image_url: string
          page_number: number
          paper_id: string
          subject_id?: string | null
        }
        Update: {
          chapter_id?: string
          correct_option_index?: number
          created_at?: string
          id?: string
          image_url?: string
          page_number?: number
          paper_id?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pyq_questions_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "pyq_papers"
            referencedColumns: ["id"]
          },
        ]
      }
      question_topics: {
        Row: {
          confidence: number
          created_at: string
          question_id: string
          topic_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          question_id: string
          topic_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          question_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_topics_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          bloom_level: number | null
          chapter_id: string
          concept_tags: string[] | null
          correct_option_index: number | null
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty_level"] | null
          explanation: string | null
          id: string
          images: Json | null
          options: Json
          question_text: string
          raw_html: string | null
          source_file: string | null
          subject_id: string
          updated_at: string
        }
        Insert: {
          bloom_level?: number | null
          chapter_id: string
          concept_tags?: string[] | null
          correct_option_index?: number | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          explanation?: string | null
          id?: string
          images?: Json | null
          options: Json
          question_text: string
          raw_html?: string | null
          source_file?: string | null
          subject_id: string
          updated_at?: string
        }
        Update: {
          bloom_level?: number | null
          chapter_id?: string
          concept_tags?: string[] | null
          correct_option_index?: number | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          explanation?: string | null
          id?: string
          images?: Json | null
          options?: Json
          question_text?: string
          raw_html?: string | null
          source_file?: string | null
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          reward_tier_unlocked: number | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          reward_tier_unlocked?: number | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          reward_tier_unlocked?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          chapter_id: string
          created_at: string
          id: string
          keywords: string[]
          name: string
          position: number
          slug: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          id?: string
          keywords?: string[]
          name: string
          position?: number
          slug: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          id?: string
          keywords?: string[]
          name?: string
          position?: number
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_broadcast_reads: {
        Row: {
          broadcast_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          broadcast_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          broadcast_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_broadcast_reads_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "admin_broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_learning_paths: {
        Row: {
          completed_at: string | null
          completed_chapters: string[]
          created_at: string | null
          current_day: number
          id: string
          path_id: string
          progress_percent: number
          started_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_chapters?: string[]
          created_at?: string | null
          current_day?: number
          id?: string
          path_id: string
          progress_percent?: number
          started_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_chapters?: string[]
          created_at?: string | null
          current_day?: number
          id?: string
          path_id?: string
          progress_percent?: number
          started_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_learning_paths_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_skill_levels: {
        Row: {
          chapter_id: string
          consecutive_correct: number
          consecutive_wrong: number
          created_at: string | null
          id: string
          last_attempted_at: string | null
          questions_attempted: number
          questions_correct: number
          skill_level: number
          subject_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          chapter_id: string
          consecutive_correct?: number
          consecutive_wrong?: number
          created_at?: string | null
          id?: string
          last_attempted_at?: string | null
          questions_attempted?: number
          questions_correct?: number
          skill_level?: number
          subject_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          chapter_id?: string
          consecutive_correct?: number
          consecutive_wrong?: number
          created_at?: string | null
          id?: string
          last_attempted_at?: string | null
          questions_attempted?: number
          questions_correct?: number
          skill_level?: number
          subject_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_skill_levels_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_skill_levels_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_activity_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      battle_advance_question: { Args: { p_room_id: string }; Returns: number }
      battle_get_question: {
        Args: { p_index: number; p_room_id: string }
        Returns: {
          ends_at: string
          options: Json
          question_id: string
          question_image: string
          question_text: string
          status: string
        }[]
      }
      battle_reveal_answer: {
        Args: { p_question_index: number; p_room_id: string }
        Returns: {
          correct_option_index: number
          explanation: string
        }[]
      }
      battle_start_room: { Args: { p_room_id: string }; Returns: undefined }
      battle_submit_answer: {
        Args: {
          p_option_index: number
          p_question_index: number
          p_room_id: string
          p_time_taken_ms: number
        }
        Returns: {
          is_correct: boolean
          new_streak: number
          score_gained: number
        }[]
      }
      calculate_battle_score: {
        Args: {
          p_current_streak: number
          p_is_correct: boolean
          p_time_limit_ms: number
          p_time_taken_ms: number
        }
        Returns: number
      }
      cleanup_old_battle_rooms: { Args: never; Returns: undefined }
      complete_referral_for_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      generate_daily_plan: { Args: { p_user_id: string }; Returns: Json }
      generate_room_code: { Args: never; Returns: string }
      get_adaptive_question: {
        Args: {
          p_chapter_id: string
          p_exclude_ids?: string[]
          p_subject_id: string
          p_user_id: string
        }
        Returns: {
          difficulty_bucket: string
          question_id: string
          skill_match_score: number
        }[]
      }
      get_admin_user_overview: { Args: never; Returns: Json }
      get_leaderboard: { Args: { p_period?: string }; Returns: Json }
      get_mock_test_analysis: { Args: { p_attempt_id: string }; Returns: Json }
      get_question_counts_per_chapter: {
        Args: never
        Returns: {
          chapter_id: string
          total: number
        }[]
      }
      get_question_counts_per_topic: {
        Args: never
        Returns: {
          topic_id: string
          total: number
        }[]
      }
      get_user_mock_progress: { Args: { p_limit?: number }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "superadmin" | "content_admin" | "student"
      attempt_type: "practice" | "mock"
      difficulty_level: "auto_easy" | "auto_medium" | "auto_hard" | "manual"
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
      app_role: ["superadmin", "content_admin", "student"],
      attempt_type: ["practice", "mock"],
      difficulty_level: ["auto_easy", "auto_medium", "auto_hard", "manual"],
    },
  },
} as const
