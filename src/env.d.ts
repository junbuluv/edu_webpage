/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@lib/supabase/database.types';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient<Database> | null;
      user: User | null;
    }
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  readonly PUBLIC_SITE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
