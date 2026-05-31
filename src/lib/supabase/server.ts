import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr';
import type { AstroCookies } from 'astro';
import type { Database } from './database.types';

const COOKIE_OPTIONS: CookieOptionsWithName = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  secure: import.meta.env.PROD,
};

export function isSupabaseConfigured() {
  return Boolean(
    import.meta.env.PUBLIC_SUPABASE_URL &&
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  );
}

export type SupabaseServerClient = ReturnType<
  typeof createSupabaseServerClient
>;

export function createSupabaseServerClient(
  cookies: AstroCookies,
  headers: Headers,
  request: Request,
) {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        // Read INCOMING cookies from the request's Cookie header.
        // (cookies.headers() returns outgoing Set-Cookie, not incoming.)
        return parseCookieHeader(request.headers.get('cookie') ?? '');
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options: CookieOptionsWithName;
        }>,
      ) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // Our COOKIE_OPTIONS must win over Supabase's defaults so that
          // secure=false sticks on http://localhost in dev. Otherwise the
          // browser silently rejects the session cookie.
          const merged = { ...options, ...COOKIE_OPTIONS };
          cookies.set(name, value, merged);
          headers.append('Set-Cookie', serializeCookie(name, value, merged));
        });
      },
    },
  });
}

function parseCookieHeader(header: string) {
  return header
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf('=');
      return {
        name: pair.slice(0, eq),
        value: decodeURIComponent(pair.slice(eq + 1)),
      };
    });
}

function serializeCookie(
  name: string,
  value: string,
  options: CookieOptionsWithName,
) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.sameSite)
    parts.push(
      `SameSite=${
        typeof options.sameSite === 'string'
          ? options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1)
          : 'Lax'
      }`,
    );
  if (options.secure) parts.push('Secure');
  if (options.httpOnly) parts.push('HttpOnly');
  return parts.join('; ');
}
