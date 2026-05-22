export { renderers } from '../../renderers.mjs';

const GET = async ({ url, redirect, locals }) => {
  if (!locals.supabase) return redirect("/auth/setup-required");
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  if (!code) return redirect("/auth/login?error=Missing+code");
  const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return redirect(
      `/auth/login?error=${encodeURIComponent(error.message)}`
    );
  }
  return redirect(next);
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
