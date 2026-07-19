/**
 * Minimal hand-written Database types for V1 foundation.
 * Replace with `supabase gen types typescript` once local Supabase is running.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          clerk_org_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          clerk_org_id?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>
      }
      users: {
        Row: {
          id: string
          auth_user_id: string | null
          clerk_user_id: string | null
          legacy_clerk_user_id: string | null
          display_name: string
          email: string | null
          avatar_url: string | null
          account_status: 'active' | 'inactive'
          allow_multi_class: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_user_id?: string | null
          clerk_user_id?: string | null
          legacy_clerk_user_id?: string | null
          display_name: string
          email?: string | null
          avatar_url?: string | null
          account_status?: 'active' | 'inactive'
          allow_multi_class?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      staff_roles: {
        Row: {
          id: string
          user_id: string
          role: 'admin' | 'teacher'
          active: boolean
          granted_by_user_id: string | null
          created_at: string
          updated_at: string
          revoked_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          role: 'admin' | 'teacher'
          active?: boolean
          granted_by_user_id?: string | null
          created_at?: string
          updated_at?: string
          revoked_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['staff_roles']['Insert']>
      }
      learner_access_tokens: {
        Row: {
          id: string
          token_hash: string
          learner_user_id: string
          class_id: string | null
          issued_by_user_id: string
          issued_at: string
          expires_at: string
          revoked_at: string | null
          last_used_at: string | null
          created_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
      organization_memberships: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: 'admin' | 'teacher' | 'learner'
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role: 'admin' | 'teacher' | 'learner'
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['organization_memberships']['Insert']>
      }
      courses: {
        Row: {
          id: string
          organization_id: string
          code: string
          name: string
          status: 'active' | 'archived'
          starts_on: string | null
          ends_on: string | null
          schedule: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          code: string
          name: string
          status?: 'active' | 'archived'
          starts_on?: string | null
          ends_on?: string | null
          schedule?: Json | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['courses']['Insert']>
      }
      scheduled_sessions: {
        Row: {
          id: string
          class_id: string
          planned_start: string
          duration_minutes: number
          status: string
          rescheduled_from_id: string | null
        }
        Insert: {
          id?: string
          class_id: string
          planned_start: string
          duration_minutes: number
          status?: string
          rescheduled_from_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['scheduled_sessions']['Insert']>
      }
      learning_sessions: {
        Row: {
          id: string
          class_id: string
          scheduled_session_id: string | null
          status: string
          planned_question_count: number | null
          started_at: string
          completed_at: string | null
          max_probe_count: number
          session_format: 'lesson' | 'test'
          prompt_language: 'vi' | 'en' | null
          live_test_resource_id: string | null
          live_test_block_id: string | null
        }
        Insert: {
          id?: string
          class_id: string
          scheduled_session_id?: string | null
          status?: string
          planned_question_count?: number | null
          started_at?: string
          completed_at?: string | null
          max_probe_count?: number
          session_format?: 'lesson' | 'test'
          prompt_language?: 'vi' | 'en' | null
          live_test_resource_id?: string | null
          live_test_block_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['learning_sessions']['Insert']>
      }
      attendance_records: {
        Row: {
          id: string
          learning_session_id: string
          learner_user_id: string
          status: string
          recorded_at: string
        }
        Insert: {
          id?: string
          learning_session_id: string
          learner_user_id: string
          status: string
          recorded_at?: string
        }
        Update: Partial<Database['public']['Tables']['attendance_records']['Insert']>
      }
      classes: {
        Row: {
          id: string
          course_id: string
          name: string
          capacity: number
          teacher_user_id: string
          status: 'active' | 'ended'
          created_at: string
        }
        Insert: {
          id?: string
          course_id: string
          name: string
          capacity?: number
          teacher_user_id: string
          status?: 'active' | 'ended'
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['classes']['Insert']>
      }
      enrollments: {
        Row: {
          id: string
          class_id: string
          learner_user_id: string
          status: 'active' | 'ended'
          started_at: string
          ended_at: string | null
        }
        Insert: {
          id?: string
          class_id: string
          learner_user_id: string
          status?: 'active' | 'ended'
          started_at?: string
          ended_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['enrollments']['Insert']>
      }
      assessment_attempt_snapshots: {
        Row: {
          id: string
          attempt_id: string
          status: string
          provisional_color: string | null
          effective_color: string | null
          effective_score: number | null
          probe_count: number
          max_probe_count: number
          entered_probe_flow: boolean
          updated_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
      audio_assets: {
        Row: {
          id: string
          organization_id: string | null
          storage_bucket: string
          storage_path: string
          mime_type: string
          duration_ms: number | null
          sha256: string | null
          created_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
      live_test_resources: {
        Row: {
          id: string
          organization_id: string | null
          title: string
          version: string
          status: 'draft' | 'active' | 'archived'
          source_filename: string | null
          source_metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
      live_test_blocks: {
        Row: Record<string, unknown>
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
      live_test_items: {
        Row: Record<string, unknown>
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
    }
    Views: Record<string, never>
    Functions: {
      issue_learner_access_token: {
        Args: { p_learner_user_id: string; p_class_id: string; p_ttl_seconds?: number }
        Returns: Array<{ token_id: string; url_token: string; expires_at: string }>
      }
      verify_learner_access: {
        Args: { p_url_token: string }
        Returns: Array<{
          token_id: string
          learner_user_id: string
          class_id: string | null
          expires_at: string
          learner_display_name: string
          learner_email: string | null
          class_name: string | null
        }>
      }
      learner_access_snapshot: {
        Args: { p_url_token: string }
        Returns: Json
      }
      revoke_learner_access_token: {
        Args: { p_token_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: 'admin' | 'teacher' | 'learner'
      result_color: 'red' | 'yellow' | 'green' | 'purple'
    }
  }
}

export type AppRole = Database['public']['Enums']['app_role']
