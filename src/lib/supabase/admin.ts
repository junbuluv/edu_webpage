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

export interface AuthUserLite {
  id: string;
  email: string | null;
}

/**
 * List every auth.users row via the admin API, paging until a short page.
 * No fixed page ceiling (a 1000-page safety bound = 1M users guards against
 * a runaway loop). Throws on API error so callers decide how to degrade.
 */
export async function listAllAuthUsers(
  admin: SupabaseClient<Database> = getAdminClient(),
): Promise<AuthUserLite[]> {
  const perPage = 1000;
  const out: AuthUserLite[] = [];
  for (let page = 1; page <= 1000; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const users = data?.users ?? [];
    for (const u of users) out.push({ id: u.id, email: u.email ?? null });
    if (users.length < perPage) break;
  }
  return out;
}

/**
 * Page through a PostgREST query past the default 1000-row response cap.
 * `makeQuery(from, to)` must apply a stable, unique ordering before
 * `.range(from, to)` so OFFSET pagination cannot skip or duplicate tied rows.
 * Returns { rows, error }; never throws, so callers can degrade gracefully.
 */
export async function selectAllRows<T>(
  makeQuery: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ rows: T[]; error: string | null }> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery(from, from + pageSize - 1);
    if (error) return { rows, error: error.message };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return { rows, error: null };
}

/**
 * Page a query while also bounding large `.in(...)` filters. PostgREST puts
 * filter values in the URL, so pagination alone does not protect a large
 * roster from proxy URL limits.
 */
export async function selectAllRowsInBatches<T, V>(
  values: readonly V[],
  makeQuery: (
    batch: V[],
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  batchSize = 100,
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  for (let start = 0; start < values.length; start += batchSize) {
    const batch = values.slice(start, start + batchSize) as V[];
    const result = await selectAllRows<T>((from, to) =>
      makeQuery(batch, from, to),
    );
    rows.push(...result.rows);
    if (result.error) return { rows, error: result.error };
  }
  return { rows, error: null };
}
