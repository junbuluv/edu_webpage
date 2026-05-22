import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  if (cached) return cached;
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY.');
  }
  cached = createBrowserClient<Database>(url, key);
  return cached;
}
