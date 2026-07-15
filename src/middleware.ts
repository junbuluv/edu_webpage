import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from '@lib/supabase/server';
import { ensureDeviceId } from '@lib/device';
import { isAdmin as isAdminRole, isStaff as isStaffRole } from '@lib/roles';
import { mutationRequestVerdict } from '@lib/security/mutation-request';
import { hasAcceptedCurrentTerms } from '@lib/auth/terms';
import { ArchiveServiceUnavailableError } from '@lib/archive/errors';

// '/exams' is reserved for the upcoming proctored-exams feature (see the
// feat/proctored-exams branch). No route exists under it yet, so it only
// gates-then-404s if visited directly — and nothing links to it. Keep the
// prefix so the gate is in place the moment exams ship.
const PROTECTED_PREFIXES = [
  '/account',
  '/dashboard',
  '/exams',
  '/workshops',
  '/eco-1002/archive',
  '/fin-3610/archive',
];
const WORKSHOP_COOKIE_PREFIXES = ['/workshops'];
const ADMIN_PREFIXES = ['/admin'];
const STAFF_PREFIXES = ['/instructor'];
const TERMS_PAGE = '/account/terms';
const TERMS_API = '/api/account/terms';
const TERMS_API_EXEMPT_PREFIXES = [
  '/api/auth',
  TERMS_API,
  '/api/account/delete',
];

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
  const url = new URL(context.request.url);
  const mutationVerdict = mutationRequestVerdict(context.request, [
    import.meta.env.PUBLIC_SITE_URL,
    import.meta.env.VERCEL_URL,
    import.meta.env.VERCEL_BRANCH_URL,
  ]);
  if (mutationVerdict !== 'ok') {
    return new Response(
      mutationVerdict === 'body_too_large'
        ? 'Request body is too large.'
        : 'Cross-origin mutation rejected.',
      {
        status: mutationVerdict === 'body_too_large' ? 413 : 403,
        headers: { 'cache-control': 'no-store' },
      },
    );
  }
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
        .select(
          'role, display_name, active_course_slug, tos_accepted_at, tos_version',
        )
        .eq('id', user.id)
        .maybeSingle();
      context.locals.profile = profile;
    }
  }

  if (
    context.locals.user &&
    matchesPrefix(url.pathname, WORKSHOP_COOKIE_PREFIXES)
  ) {
    ensureDeviceId(context.cookies, import.meta.env.PROD);
  }

  const role = context.locals.profile?.role ?? 'student';
  const isAdmin = isAdminRole(role);
  const isStaff = isStaffRole(role);
  const acceptedTerms = hasAcceptedCurrentTerms(context.locals.profile);
  const isProtectedPage =
    matchesPrefix(url.pathname, ADMIN_PREFIXES) ||
    matchesPrefix(url.pathname, STAFF_PREFIXES) ||
    matchesPrefix(url.pathname, PROTECTED_PREFIXES);
  const isTermsExemptApi = TERMS_API_EXEMPT_PREFIXES.some(
    (prefix) =>
      url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
  );

  if (
    context.locals.user &&
    !acceptedTerms &&
    url.pathname !== TERMS_PAGE &&
    ((isProtectedPage && !url.pathname.startsWith('/account/delete')) ||
      (url.pathname.startsWith('/api/') && !isTermsExemptApi))
  ) {
    if (url.pathname.startsWith('/api/')) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'terms_acceptance_required' }),
        {
          status: 428,
          headers: {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          },
        },
      );
    }
    return context.redirect(
      `${TERMS_PAGE}?next=${encodeURIComponent(url.pathname + url.search)}`,
    );
  }

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

  let response: Response;
  try {
    response = await next();
  } catch (error) {
    if (!(error instanceof ArchiveServiceUnavailableError)) throw error;
    response = new Response(
      'A required data service is temporarily unavailable.',
      {
        status: 503,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'private, no-store',
        },
      },
    );
  }
  headers.forEach((value, key) => response.headers.append(key, value));
  return response;
});
