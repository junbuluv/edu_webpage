import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from '@lib/supabase/server';
import { ensureDeviceId } from '@lib/device';
import { isAdmin as isAdminRole, isStaff as isStaffRole } from '@lib/roles';

const PROTECTED_PREFIXES = ['/account', '/dashboard', '/exams', '/workshops'];
const ADMIN_PREFIXES = ['/admin'];
const STAFF_PREFIXES = ['/instructor'];

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

  if (ADMIN_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    if (!context.locals.user) {
      if (!supabase) return context.redirect('/auth/setup-required');
      return context.redirect(
        `/auth/login?next=${encodeURIComponent(url.pathname)}`,
      );
    }
    if (!isAdmin) return context.redirect('/');
  } else if (STAFF_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    if (!context.locals.user) {
      if (!supabase) return context.redirect('/auth/setup-required');
      return context.redirect(
        `/auth/login?next=${encodeURIComponent(url.pathname)}`,
      );
    }
    if (!isStaff) return context.redirect('/');
  } else if (PROTECTED_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    if (!context.locals.user) {
      if (!supabase) return context.redirect('/auth/setup-required');
      return context.redirect(
        `/auth/login?next=${encodeURIComponent(url.pathname)}`,
      );
    }
  }

  const response = await next();
  headers.forEach((value, key) => response.headers.append(key, value));
  return response;
});
