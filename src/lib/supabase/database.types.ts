// Placeholder. Replace by running:
//   npm run supabase:types
// after creating your Supabase project and applying supabase/schema.sql.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          role: 'student' | 'instructor' | 'admin';
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          role?: 'student' | 'instructor' | 'admin';
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
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
        Update: Partial<
          Database['public']['Tables']['lesson_progress']['Insert']
        >;
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
        Update: Partial<
          Database['public']['Tables']['quiz_attempts']['Insert']
        >;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: 'student' | 'instructor' | 'admin';
      progress_status: 'started' | 'completed';
    };
  };
}
