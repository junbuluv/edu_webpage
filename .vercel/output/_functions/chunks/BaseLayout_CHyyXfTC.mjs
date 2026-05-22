import { a7 as createAstro, a8 as createComponent, a4 as addAttribute, an as renderHead, al as renderComponent, n as Fragment, at as renderTemplate, ar as renderSlot } from './astro/server_SoPnprkE.mjs';
import 'piccolore';
/* empty css                          */

const $$Astro = createAstro("https://edu.example.com");
const $$BaseLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$BaseLayout;
  const { title, description = "Interactive Economics & Finance lessons for undergraduates." } = Astro2.props;
  const user = Astro2.locals.user;
  return renderTemplate`<html lang="en"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><meta name="description"${addAttribute(description, "content")}><title>${title} — Econ Studio</title>${renderHead()}</head> <body class="min-h-screen flex flex-col"> <header class="border-b border-slate-200 bg-white"> <div class="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between"> <a href="/" class="font-semibold text-lg tracking-tight">Econ Studio</a> <nav class="flex items-center gap-4 text-sm"> <a href="/macro" class="text-ink-muted hover:text-ink">Macro</a> <a href="/practice" class="text-ink-muted hover:text-ink">Practice</a> ${user ? renderTemplate`${renderComponent($$result, "Fragment", Fragment, {}, { "default": ($$result2) => renderTemplate` <a href="/dashboard" class="text-ink-muted hover:text-ink">Dashboard</a> <form method="POST" action="/api/auth/signout" class="inline"> <button class="text-ink-muted hover:text-ink" type="submit">
Sign out
</button> </form> ` })}` : renderTemplate`<a class="rounded bg-accent px-3 py-1.5 text-white text-sm" href="/auth/login">
Sign in
</a>`} </nav> </div> </header> <main class="flex-1"> ${renderSlot($$result, $$slots["default"])} </main> <footer class="border-t border-slate-200 py-8 mt-12 text-sm text-ink-muted"> <div class="mx-auto max-w-6xl px-4 flex justify-between"> <span>© ${(/* @__PURE__ */ new Date()).getFullYear()} Econ Studio</span> <span>Built with Astro + Supabase</span> </div> </footer> </body></html>`;
}, "/Volumes/harmless_ssd/edu_web/src/layouts/BaseLayout.astro", void 0);

export { $$BaseLayout as $ };
