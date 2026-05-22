export { renderers } from '../../../renderers.mjs';

const POST = async ({ request, redirect, locals }) => {
  if (!locals.supabase) return redirect("/auth/setup-required");
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");
  const { error } = await locals.supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) {
    return redirect(
      `/auth/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent(error.message)}`
    );
  }
  return redirect(next);
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
