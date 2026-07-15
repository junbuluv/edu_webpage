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
          tos_version: string | null;
          active_course_slug: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email_hmac?: string | null;
          display_name?: string | null;
          role?: 'student' | 'instructor' | 'ta' | 'admin';
          tos_accepted_at?: string | null;
          tos_version?: string | null;
          active_course_slug?: string | null;
        };
        Update: {
          id?: string;
          email_hmac?: string | null;
          display_name?: string | null;
          role?: 'student' | 'instructor' | 'ta' | 'admin';
          tos_accepted_at?: string | null;
          tos_version?: string | null;
          active_course_slug?: string | null;
        };
        Relationships: [];
      };
      terms_acceptances: {
        Row: {
          user_id: string;
          policy_version: string;
          accepted_at: string;
          source: string;
        };
        Insert: {
          user_id: string;
          policy_version: string;
          accepted_at?: string;
          source: string;
        };
        Update: {
          user_id?: string;
          policy_version?: string;
          accepted_at?: string;
          source?: string;
        };
        Relationships: [];
      };
      teaching_assignments: {
        Row: {
          instructor_id: string;
          course_slug: string;
          semester: string;
          active: boolean;
          assigned_by: string | null;
          assigned_at: string;
          updated_at: string;
        };
        Insert: {
          instructor_id: string;
          course_slug: string;
          semester: string;
          active?: boolean;
          assigned_by?: string | null;
          assigned_at?: string;
          updated_at?: string;
        };
        Update: {
          instructor_id?: string;
          course_slug?: string;
          semester?: string;
          active?: boolean;
          assigned_by?: string | null;
          assigned_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lesson_progress: {
        Row: {
          user_id: string;
          lesson_slug: string;
          course_slug: string | null;
          status: 'started' | 'completed';
          completed_at: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          lesson_slug: string;
          course_slug?: string | null;
          status?: 'started' | 'completed';
          completed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          lesson_slug?: string;
          course_slug?: string | null;
          status?: 'started' | 'completed';
          completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      offering_lesson_progress: {
        Row: {
          user_id: string;
          course_slug: string;
          semester: string;
          instructor_id: string;
          lesson_slug: string;
          status: 'started' | 'completed';
          completed_at: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          course_slug: string;
          semester: string;
          instructor_id: string;
          lesson_slug: string;
          status?: 'started' | 'completed';
          completed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          course_slug?: string;
          semester?: string;
          instructor_id?: string;
          lesson_slug?: string;
          status?: 'started' | 'completed';
          completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      quiz_attempts: {
        Row: {
          id: string;
          client_attempt_id: string;
          user_id: string;
          quiz_slug: string;
          course_slug: string | null;
          semester: string | null;
          instructor_id: string | null;
          score: number;
          max_score: number;
          answers: Json;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          client_attempt_id?: string;
          user_id: string;
          quiz_slug: string;
          course_slug?: string | null;
          semester?: string | null;
          instructor_id?: string | null;
          score: number;
          max_score: number;
          answers: Json;
        };
        Update: {
          id?: string;
          client_attempt_id?: string;
          user_id?: string;
          quiz_slug?: string;
          course_slug?: string | null;
          semester?: string | null;
          instructor_id?: string | null;
          score?: number;
          max_score?: number;
          answers?: Json;
        };
        Relationships: [];
      };
      archive_videos: {
        Row: {
          id: string;
          course_slug: string;
          lesson_slug: string;
          semester_term: 'spring' | 'summer' | 'fall';
          semester_year: number;
          title: string;
          provider: 'youtube' | 'vimeo';
          video_id: string;
          description: string | null;
          duration_minutes: number | null;
          created_by: string;
          published: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_slug: string;
          lesson_slug: string;
          semester_term: 'spring' | 'summer' | 'fall';
          semester_year: number;
          title: string;
          provider: 'youtube' | 'vimeo';
          video_id: string;
          description?: string | null;
          duration_minutes?: number | null;
          created_by: string;
          published?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          course_slug?: string;
          lesson_slug?: string;
          semester_term?: 'spring' | 'summer' | 'fall';
          semester_year?: number;
          title?: string;
          provider?: 'youtube' | 'vimeo';
          video_id?: string;
          description?: string | null;
          duration_minutes?: number | null;
          created_by?: string;
          published?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      archive_quizzes: {
        Row: {
          id: string;
          course_slug: string;
          kind: 'exam' | 'assignment';
          title: string;
          semester_term: 'spring' | 'summer' | 'fall';
          semester_year: number;
          covers: string[];
          questions: Json;
          passing_score: number;
          created_by: string;
          published: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_slug: string;
          kind: 'exam' | 'assignment';
          title: string;
          semester_term: 'spring' | 'summer' | 'fall';
          semester_year: number;
          covers?: string[];
          questions: Json;
          passing_score?: number;
          created_by: string;
          published?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          course_slug?: string;
          kind?: 'exam' | 'assignment';
          title?: string;
          semester_term?: 'spring' | 'summer' | 'fall';
          semester_year?: number;
          covers?: string[];
          questions?: Json;
          passing_score?: number;
          created_by?: string;
          published?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      archive_papers: {
        Row: {
          id: string;
          course_slug: string;
          kind: 'exam' | 'assignment';
          title: string;
          semester_term: 'spring' | 'summer' | 'fall';
          semester_year: number;
          covers: string[];
          storage_path: string;
          original_filename: string;
          content_type: string;
          size_bytes: number;
          created_by: string;
          upload_intent_id: string | null;
          published: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_slug: string;
          kind: 'exam' | 'assignment';
          title: string;
          semester_term: 'spring' | 'summer' | 'fall';
          semester_year: number;
          covers?: string[];
          storage_path: string;
          original_filename: string;
          content_type: string;
          size_bytes: number;
          created_by: string;
          upload_intent_id?: string | null;
          published?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          course_slug?: string;
          kind?: 'exam' | 'assignment';
          title?: string;
          semester_term?: 'spring' | 'summer' | 'fall';
          semester_year?: number;
          covers?: string[];
          storage_path?: string;
          original_filename?: string;
          content_type?: string;
          size_bytes?: number;
          created_by?: string;
          upload_intent_id?: string | null;
          published?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      archive_paper_upload_intents: {
        Row: {
          id: string;
          actor_id: string;
          course_slug: string;
          kind: 'exam' | 'assignment';
          title: string;
          semester_term: 'spring' | 'summer' | 'fall';
          semester_year: number;
          covers: string[];
          storage_path: string;
          original_filename: string;
          content_type: string;
          file_size: number;
          published: boolean;
          state: 'pending' | 'finalized' | 'expired';
          expires_at: string;
          created_at: string;
          finalized_at: string | null;
        };
        Insert: {
          id?: string;
          actor_id: string;
          course_slug: string;
          kind: 'exam' | 'assignment';
          title: string;
          semester_term: 'spring' | 'summer' | 'fall';
          semester_year: number;
          covers?: string[];
          storage_path: string;
          original_filename: string;
          content_type: string;
          file_size: number;
          published?: boolean;
          state?: 'pending' | 'finalized' | 'expired';
          expires_at: string;
          created_at?: string;
          finalized_at?: string | null;
        };
        Update: {
          id?: string;
          actor_id?: string;
          course_slug?: string;
          kind?: 'exam' | 'assignment';
          title?: string;
          semester_term?: 'spring' | 'summer' | 'fall';
          semester_year?: number;
          covers?: string[];
          storage_path?: string;
          original_filename?: string;
          content_type?: string;
          file_size?: number;
          published?: boolean;
          state?: 'pending' | 'finalized' | 'expired';
          expires_at?: string;
          created_at?: string;
          finalized_at?: string | null;
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
          student_name: string | null;
          section: string | null;
        };
        Insert: {
          user_id: string;
          course_slug: string;
          instructor_id: string;
          semester: string;
          enrolled_at?: string;
          student_name?: string | null;
          section?: string | null;
        };
        Update: {
          user_id?: string;
          course_slug?: string;
          instructor_id?: string;
          semester?: string;
          enrolled_at?: string;
          student_name?: string | null;
          section?: string | null;
        };
        Relationships: [];
      };
      workshop_administrations: {
        Row: {
          id: string;
          workshop_slug: string;
          course_slug: string;
          semester: string;
          section: 'CML' | 'CTL' | 'CWL' | 'CRL' | null;
          week_of: string;
          schedule_version: number;
          instructor_id: string;
          opens_at: string;
          closes_at: string;
          required_lat: number | null;
          required_lng: number | null;
          geofence_required: boolean;
          required_radius_meters: number;
          location_label: string;
          questions_revealed_at: string | null;
          cancelled_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workshop_slug: string;
          course_slug: string;
          semester: string;
          section?: 'CML' | 'CTL' | 'CWL' | 'CRL' | null;
          week_of: string;
          schedule_version?: number;
          instructor_id: string;
          opens_at: string;
          closes_at: string;
          required_lat?: number | null;
          required_lng?: number | null;
          geofence_required?: never;
          required_radius_meters?: number;
          location_label?: string;
          questions_revealed_at?: string | null;
          cancelled_at?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          workshop_slug?: string;
          course_slug?: string;
          semester?: string;
          section?: 'CML' | 'CTL' | 'CWL' | 'CRL' | null;
          week_of?: string;
          schedule_version?: number;
          instructor_id?: string;
          opens_at?: string;
          closes_at?: string;
          required_lat?: number | null;
          required_lng?: number | null;
          geofence_required?: never;
          required_radius_meters?: number;
          location_label?: string;
          questions_revealed_at?: string | null;
          cancelled_at?: string | null;
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
          device_hmac: string | null;
          verification_method: 'geofence' | 'window' | 'manual' | 'legacy';
          recorded_by: string | null;
          correction_reason: string | null;
        };
        Insert: {
          id?: string;
          administration_id: string;
          user_id: string;
          stamped_at?: string;
          device_hmac?: string | null;
          verification_method: 'geofence' | 'window' | 'manual' | 'legacy';
          recorded_by?: string | null;
          correction_reason?: string | null;
        };
        Update: {
          id?: string;
          administration_id?: string;
          user_id?: string;
          stamped_at?: string;
          device_hmac?: string | null;
          verification_method?: 'geofence' | 'window' | 'manual' | 'legacy';
          recorded_by?: string | null;
          correction_reason?: string | null;
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
      accept_terms: {
        Args: {
          p_user_id: string;
          p_policy_version: string;
          p_source: string;
        };
        Returns: string;
      };
      apply_roster_import: {
        Args: {
          p_actor_id: string;
          p_instructor_id: string;
          p_course_slug: string;
          p_semester: string;
          p_rows: Json;
        };
        Returns: boolean;
      };
      claim_archive_paper_upload_intents: {
        Args: {
          p_actor_id: string | null;
          p_before: string;
          p_limit?: number;
        };
        Returns: Array<{
          intent_id: string;
          storage_path: string;
          action: string;
        }>;
      };
      log_disclosure: {
        Args: {
          p_action: string;
          p_target_user_id: string;
          p_target_resource?: string | null;
          p_metadata?: Json | null;
        };
        Returns: void;
      };
      offboard_staff: {
        Args: {
          p_actor_id: string;
          p_target_id: string;
          p_successor_id: string;
        };
        Returns: string;
      };
      record_lesson_progress: {
        Args: {
          p_user_id: string;
          p_lesson_slug: string;
          p_course_slug: string;
          p_operation: string;
        };
        Returns: string;
      };
      record_quiz_attempt: {
        Args: {
          p_user_id: string;
          p_quiz_slug: string;
          p_course_slug: string;
          p_score: number;
          p_max_score: number;
          p_answers: Json;
          p_client_attempt_id: string;
        };
        Returns: string;
      };
      reserve_archive_paper_upload_intent: {
        Args: {
          p_id: string;
          p_actor_id: string;
          p_course_slug: string;
          p_kind: string;
          p_title: string;
          p_semester_term: string;
          p_semester_year: number;
          p_covers: string[];
          p_storage_path: string;
          p_original_filename: string;
          p_content_type: string;
          p_file_size: number;
          p_expires_at: string;
        };
        Returns: boolean;
      };
      record_workshop_stamp: {
        Args: {
          p_user_id: string;
          p_administration_id: string;
          p_device_hmac: string;
          p_verification_method: string;
        };
        Returns: boolean;
      };
      mutate_archive_item: {
        Args: {
          p_actor_id: string;
          p_resource: string;
          p_id: string;
          p_operation: string;
          p_patch?: Json;
        };
        Returns: boolean;
      };
      mutate_enrollment: {
        Args: {
          p_actor_id: string;
          p_user_id: string;
          p_course_slug: string;
          p_semester: string;
          p_instructor_id: string;
          p_student_name: string | null;
          p_section: string | null;
          p_operation: string;
        };
        Returns: boolean;
      };
      mutate_workshop: {
        Args: {
          p_actor_id: string;
          p_administration_id: string;
          p_operation: string;
          p_target_user_id?: string | null;
          p_reason?: string | null;
        };
        Returns: boolean;
      };
      resolve_current_enrollment_scope: {
        Args: {
          p_user_id: string;
          p_course_slug: string;
        };
        Returns: Array<{
          semester: string;
          instructor_id: string;
        }>;
      };
      transfer_enrollment_scope: {
        Args: {
          p_actor_id: string;
          p_user_id: string;
          p_course_slug: string;
          p_semester: string;
          p_current_instructor_id: string;
          p_new_instructor_id: string;
          p_student_name: string | null;
          p_section: string | null;
        };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: 'student' | 'instructor' | 'ta' | 'admin';
      progress_status: 'started' | 'completed';
      workshop_section: 'CML' | 'CTL' | 'CWL' | 'CRL';
    };
    CompositeTypes: Record<string, never>;
  };
};
