import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from '@lib/supabase/server';

const PROTECTED_PREFIXES = ['/account', '/dashboard'];

export const onRequest = defineMiddleware(async (context, next) => {
  const headers = new Headers();
  const supabase = createSupabaseServerClient(context.cookies, headers);

  context.locals.supabase = supabase;
  context.locals.user = null;

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user;
  }

  const url = new URL(context.request.url);
  const needsAuth = PROTECTED_PREFIXES.some((p) => url.pathname.startsWith(p));
  if (needsAuth && !context.locals.user) {
    if (!supabase) return context.redirect('/auth/setup-required');
    return context.redirect(
      `/auth/login?next=${encodeURIComponent(url.pathname)}`,
    );
  }

  const response = await next();
  headers.forEach((value, key) => response.headers.append(key, value));
  return response;
});
