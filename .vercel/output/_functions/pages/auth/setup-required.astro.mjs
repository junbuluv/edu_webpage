import { a8 as createComponent, al as renderComponent, at as renderTemplate, ai as maybeRenderHead } from '../../chunks/astro/server_SoPnprkE.mjs';
import 'piccolore';
import { $ as $$BaseLayout } from '../../chunks/BaseLayout_CHyyXfTC.mjs';
export { renderers } from '../../renderers.mjs';

const $$SetupRequired = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Supabase setup required" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="mx-auto max-w-xl py-16 px-4"> <h1 class="text-2xl font-semibold">Supabase isn't configured yet</h1> <p class="mt-3 text-ink-muted">
Lessons and practice quizzes still work in this dev session — but
      accounts, progress tracking, and the dashboard need a Supabase project.
</p> <ol class="mt-6 list-decimal space-y-3 pl-5 text-sm"> <li>Create a project at <a class="text-accent underline" href="https://supabase.com">supabase.com</a> (free tier is fine).</li> <li>Copy <code class="rounded bg-slate-100 px-1.5 py-0.5">.env.example</code> to <code class="rounded bg-slate-100 px-1.5 py-0.5">.env</code> and paste your project URL + anon key.</li> <li>Open the SQL editor and run <code class="rounded bg-slate-100 px-1.5 py-0.5">supabase/schema.sql</code>.</li> <li>Restart the dev server: <code class="rounded bg-slate-100 px-1.5 py-0.5">npm run dev</code>.</li> </ol> <p class="mt-8"> <a class="text-accent underline" href="/">← Back to lessons</a> </p> </div> ` })}`;
}, "/Volumes/harmless_ssd/edu_web/src/pages/auth/setup-required.astro", void 0);

const $$file = "/Volumes/harmless_ssd/edu_web/src/pages/auth/setup-required.astro";
const $$url = "/auth/setup-required";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$SetupRequired,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
