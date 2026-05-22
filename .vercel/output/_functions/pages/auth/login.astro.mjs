import { a7 as createAstro, a8 as createComponent, al as renderComponent, at as renderTemplate, ai as maybeRenderHead, a4 as addAttribute } from '../../chunks/astro/server_SoPnprkE.mjs';
import 'piccolore';
import { $ as $$BaseLayout } from '../../chunks/BaseLayout_CHyyXfTC.mjs';
export { renderers } from '../../renderers.mjs';

const $$Astro = createAstro("https://edu.example.com");
const $$Login = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Login;
  const next = Astro2.url.searchParams.get("next") ?? "/";
  const error = Astro2.url.searchParams.get("error");
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Sign in" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="mx-auto max-w-md py-16"> <h1 class="text-2xl font-semibold mb-2">Sign in</h1> <p class="text-ink-muted mb-8">
Track your progress across courses and review past quiz attempts.
</p> ${error && renderTemplate`<div class="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"> ${decodeURIComponent(error)} </div>`} <form method="POST" action="/api/auth/signin" class="space-y-4"> <input type="hidden" name="next"${addAttribute(next, "value")}> <label class="block"> <span class="text-sm font-medium">Email</span> <input name="email" type="email" required autocomplete="email" class="mt-1 w-full rounded border border-slate-300 px-3 py-2"> </label> <label class="block"> <span class="text-sm font-medium">Password</span> <input name="password" type="password" required autocomplete="current-password" minlength="8" class="mt-1 w-full rounded border border-slate-300 px-3 py-2"> </label> <button type="submit" class="w-full rounded bg-accent px-4 py-2 font-medium text-white hover:bg-blue-700">
Sign in
</button> </form> <p class="mt-6 text-sm text-ink-muted">
No account yet?
<a class="text-accent underline"${addAttribute(`/auth/signup?next=${encodeURIComponent(next)}`, "href")}>Create one</a> </p> </div> ` })}`;
}, "/Volumes/harmless_ssd/edu_web/src/pages/auth/login.astro", void 0);

const $$file = "/Volumes/harmless_ssd/edu_web/src/pages/auth/login.astro";
const $$url = "/auth/login";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Login,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
