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
          clerk_user_id: string
          display_name: string
          email: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clerk_user_id: string
          display_name: string
          email?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      app_role: 'admin' | 'teacher' | 'learner'
      result_color: 'red' | 'yellow' | 'green' | 'purple'
    }
  }
}

export type AppRole = Database['public']['Enums']['app_role']
