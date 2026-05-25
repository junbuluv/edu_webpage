/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

import type { User } from '@supabase/supabase-js';
import type { SupabaseServerClient } from '@lib/supabase/server';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseServerClient;
      user: User | null;
      profile: {
        role: 'student' | 'instructor' | 'ta' | 'admin';
        display_name: string | null;
        active_course_slug: string | null;
      } | null;
    }
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  readonly PUBLIC_SITE_URL: string;
  readonly PII_HMAC_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
