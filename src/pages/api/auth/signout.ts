import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ redirect, locals }) => {
  if (locals.supabase) await locals.supabase.auth.signOut();
  return redirect('/');
};
