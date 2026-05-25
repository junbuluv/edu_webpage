// Placeholder. Replace by running `npm run supabase:types` once your project
// is created. The shape below matches what `supabase gen types typescript`
// emits so query results type-check correctly against this stub.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email_hmac: string | null;
          display_name: string | null;
          role: 'student' | 'instructor' | 'ta' | 'admin';
          tos_accepted_at: string | null;
          active_course_slug: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email_hmac?: string | null;
          display_name?: string | null;
          role?: 'student' | 'instructor' | 'ta' | 'admin';
          tos_accepted_at?: string | null;
          active_course_slug?: string | null;
        };
        Update: {
          id?: string;
          email_hmac?: string | null;
          display_name?: string | null;
          role?: 'student' | 'instructor' | 'ta' | 'admin';
          tos_accepted_at?: string | null;
          active_course_slug?: string | null;
        };
        Relationships: [];
      };
      lesson_progress: {
        Row: {
          user_id: string;
          lesson_slug: string;
          status: 'started' | 'completed';
          completed_at: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          lesson_slug: string;
          status?: 'started' | 'completed';
          completed_at?: string | null;
        };
        Update: {
          user_id?: string;
          lesson_slug?: string;
          status?: 'started' | 'completed';
          completed_at?: string | null;
        };
        Relationships: [];
      };
      quiz_attempts: {
        Row: {
          id: string;
          user_id: string;
          quiz_slug: string;
          score: number;
          max_score: number;
          answers: Json;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          quiz_slug: string;
          score: number;
          max_score: number;
          answers: Json;
        };
        Update: {
          id?: string;
          user_id?: string;
          quiz_slug?: string;
          score?: number;
          max_score?: number;
          answers?: Json;
        };
        Relationships: [];
      };
      enrollments: {
        Row: {
          user_id: string;
          course_slug: string;
          instructor_id: string;
          semester: string;
          enrolled_at: string;
        };
        Insert: {
          user_id: string;
          course_slug: string;
          instructor_id: string;
          semester: string;
          enrolled_at?: string;
        };
        Update: {
          user_id?: string;
          course_slug?: string;
          instructor_id?: string;
          semester?: string;
          enrolled_at?: string;
        };
        Relationships: [];
      };
      workshop_administrations: {
        Row: {
          id: string;
          workshop_slug: string;
          course_slug: string;
          section: 'CML' | 'CTL' | 'CWL' | 'CRL' | null;
          week_of: string;
          instructor_id: string;
          opens_at: string;
          closes_at: string;
          required_lat: number | null;
          required_lng: number | null;
          required_radius_meters: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workshop_slug: string;
          course_slug: string;
          section?: 'CML' | 'CTL' | 'CWL' | 'CRL' | null;
          week_of: string;
          instructor_id: string;
          opens_at: string;
          closes_at: string;
          required_lat?: number | null;
          required_lng?: number | null;
          required_radius_meters?: number;
          notes?: string | null;
        };
        Update: {
          id?: string;
          workshop_slug?: string;
          course_slug?: string;
          section?: 'CML' | 'CTL' | 'CWL' | 'CRL' | null;
          week_of?: string;
          instructor_id?: string;
          opens_at?: string;
          closes_at?: string;
          required_lat?: number | null;
          required_lng?: number | null;
          required_radius_meters?: number;
          notes?: string | null;
        };
        Relationships: [];
      };
      workshop_attendance: {
        Row: {
          id: string;
          administration_id: string;
          user_id: string;
          stamped_at: string;
          device_id: string;
          client_lat: number | null;
          client_lng: number | null;
          client_ip_hmac: string | null;
          user_agent_hmac: string | null;
        };
        Insert: {
          id?: string;
          administration_id: string;
          user_id: string;
          stamped_at?: string;
          device_id: string;
          client_lat?: number | null;
          client_lng?: number | null;
          client_ip_hmac?: string | null;
          user_agent_hmac?: string | null;
        };
        Update: {
          id?: string;
          administration_id?: string;
          user_id?: string;
          stamped_at?: string;
          device_id?: string;
          client_lat?: number | null;
          client_lng?: number | null;
          client_ip_hmac?: string | null;
          user_agent_hmac?: string | null;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_role: 'student' | 'instructor' | 'ta' | 'admin' | null;
          action: string;
          target_user_id: string | null;
          target_resource: string | null;
          client_ip_hmac: string | null;
          user_agent_hmac: string | null;
          metadata: Json | null;
          ts: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          actor_role?: 'student' | 'instructor' | 'ta' | 'admin' | null;
          action: string;
          target_user_id?: string | null;
          target_resource?: string | null;
          client_ip_hmac?: string | null;
          user_agent_hmac?: string | null;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          actor_role?: 'student' | 'instructor' | 'ta' | 'admin' | null;
          action?: string;
          target_user_id?: string | null;
          target_resource?: string | null;
          client_ip_hmac?: string | null;
          user_agent_hmac?: string | null;
          metadata?: Json | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      log_disclosure: {
        Args: {
          p_action: string;
          p_target_user_id: string;
          p_target_resource?: string | null;
          p_metadata?: Json | null;
        };
        Returns: void;
      };
    };
    Enums: {
      user_role: 'student' | 'instructor' | 'ta' | 'admin';
      progress_status: 'started' | 'completed';
    };
    CompositeTypes: Record<string, never>;
  };
};
