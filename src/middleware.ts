import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from '@lib/supabase/server';
import { ensureDeviceId } from '@lib/device';
import { isAdmin as isAdminRole, isStaff as isStaffRole } from '@lib/roles';

const PROTECTED_PREFIXES = ['/account', '/dashboard', '/exams', '/workshops'];
const ADMIN_PREFIXES = ['/admin'];
const STAFF_PREFIXES = ['/instructor'];

// Match on path segments, not raw string prefix. A loose
// `startsWith('/instructor')` would also catch any `/instructors...` sibling
// (e.g. a future top-level instructor route), silently gating it behind the
// staff check. Require an exact match or a trailing-slash boundary so
// `/instructor` gates `/instructor/workshops` but never an `/instructors/...`
// sibling. (Public instructor profiles live under `/<course>/instructors/`,
// which already never matched — this keeps it that way defensively.)
function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const onRequest = defineMiddleware(async (context, next) => {
  // Issue a device_id cookie on first visit. Used by the workshop stamp
  // flow to enforce one-stamp-per-device. Set early so it's available
  // even for unauthenticated routes (the cookie predates login).
  ensureDeviceId(context.cookies, import.meta.env.PROD);

  const headers = new Headers();
  const supabase = createSupabaseServerClient(
    context.cookies,
    headers,
    context.request,
  );

  context.locals.supabase = supabase;
  context.locals.user = null;
  context.locals.profile = null;

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user;

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, display_name, active_course_slug')
        .eq('id', user.id)
        .maybeSingle();
      context.locals.profile = profile;
    }
  }

  const url = new URL(context.request.url);
  const role = context.locals.profile?.role ?? 'student';
  const isAdmin = isAdminRole(role);
  const isStaff = isStaffRole(role);

  if (matchesPrefix(url.pathname, ADMIN_PREFIXES)) {
    if (!context.locals.user) {
      if (!supabase) return context.redirect('/auth/setup-required');
      return context.redirect(
        `/auth/signin?next=${encodeURIComponent(url.pathname)}`,
      );
    }
    if (!isAdmin) return context.redirect('/');
  } else if (matchesPrefix(url.pathname, STAFF_PREFIXES)) {
    if (!context.locals.user) {
      if (!supabase) return context.redirect('/auth/setup-required');
      return context.redirect(
        `/auth/signin?next=${encodeURIComponent(url.pathname)}`,
      );
    }
    if (!isStaff) return context.redirect('/');
  } else if (matchesPrefix(url.pathname, PROTECTED_PREFIXES)) {
    if (!context.locals.user) {
      if (!supabase) return context.redirect('/auth/setup-required');
      return context.redirect(
        `/auth/signin?next=${encodeURIComponent(url.pathname)}`,
      );
    }
  }

  const response = await next();
  headers.forEach((value, key) => response.headers.append(key, value));
  return response;
});
