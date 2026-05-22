// Service-role Supabase client. Server-only. NEVER import from a `.tsx`,
// from anything under `src/components/`, or from a file that hydrates on the
// browser. If you accidentally do, the bundle will fail to build because
// import.meta.env.SUPABASE_SERVICE_ROLE_KEY is undefined at the client.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let cached: SupabaseClient<Database> | null = null;

export function getAdminClient(): SupabaseClient<Database> {
  if (cached) return cached;

  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set ' +
        'to use the admin Supabase client.',
    );
  }

  cached = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
