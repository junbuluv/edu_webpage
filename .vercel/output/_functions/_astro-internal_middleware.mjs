import { d as defineMiddleware, s as sequence } from './chunks/index_BdC93e7j.mjs';
import { createServerClient } from '@supabase/ssr';
import 'es-module-lexer';
import './chunks/astro-designed-error-pages_1ZAIMbsC.mjs';
import 'piccolore';
import './chunks/astro/server_SoPnprkE.mjs';
import 'clsx';

const COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure: true
};
function createSupabaseServerClient(cookies, headers) {
  const supabaseUrl = "https://placeholder.supabase.co";
  const supabaseAnonKey = "placeholder";
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return Array.from(cookies.headers()).flatMap(
          ([name, value]) => name === "cookie" ? parseCookieHeader(value) : []
        );
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, { ...COOKIE_OPTIONS, ...options });
          headers.append(
            "Set-Cookie",
            serializeCookie(name, value, { ...COOKIE_OPTIONS, ...options })
          );
        });
      }
    }
  });
}
function parseCookieHeader(header) {
  return header.split(";").map((pair) => pair.trim()).filter(Boolean).map((pair) => {
    const eq = pair.indexOf("=");
    return {
      name: pair.slice(0, eq),
      value: decodeURIComponent(pair.slice(eq + 1))
    };
  });
}
function serializeCookie(name, value, options) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.sameSite)
    parts.push(
      `SameSite=${typeof options.sameSite === "string" ? options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1) : "Lax"}`
    );
  if (options.secure) parts.push("Secure");
  if (options.httpOnly) parts.push("HttpOnly");
  return parts.join("; ");
}

const PROTECTED_PREFIXES = ["/account", "/dashboard"];
const onRequest$1 = defineMiddleware(async (context, next) => {
  const headers = new Headers();
  const supabase = createSupabaseServerClient(context.cookies, headers);
  context.locals.supabase = supabase;
  context.locals.user = null;
  if (supabase) {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    context.locals.user = user;
  }
  const url = new URL(context.request.url);
  const needsAuth = PROTECTED_PREFIXES.some((p) => url.pathname.startsWith(p));
  if (needsAuth && !context.locals.user) {
    if (!supabase) return context.redirect("/auth/setup-required");
    return context.redirect(
      `/auth/login?next=${encodeURIComponent(url.pathname)}`
    );
  }
  const response = await next();
  headers.forEach((value, key) => response.headers.append(key, value));
  return response;
});

const onRequest = sequence(
	
	onRequest$1
	
);

export { onRequest };
