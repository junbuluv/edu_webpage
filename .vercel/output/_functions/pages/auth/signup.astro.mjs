import { a7 as createAstro, a8 as createComponent, al as renderComponent, at as renderTemplate, ai as maybeRenderHead, a4 as addAttribute } from '../../chunks/astro/server_SoPnprkE.mjs';
import 'piccolore';
import { $ as $$BaseLayout } from '../../chunks/BaseLayout_CHyyXfTC.mjs';
export { renderers } from '../../renderers.mjs';

const $$Astro = createAstro("https://edu.example.com");
const $$Signup = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Signup;
  const next = Astro2.url.searchParams.get("next") ?? "/";
  const error = Astro2.url.searchParams.get("error");
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Create account" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="mx-auto max-w-md py-16"> <h1 class="text-2xl font-semibold mb-2">Create account</h1> <p class="text-ink-muted mb-8">
Free for students. Use your school email if your instructor is grading.
</p> ${error && renderTemplate`<div class="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"> ${decodeURIComponent(error)} </div>`} <form method="POST" action="/api/auth/signup" class="space-y-4"> <input type="hidden" name="next"${addAttribute(next, "value")}> <label class="block"> <span class="text-sm font-medium">Email</span> <input name="email" type="email" required autocomplete="email" class="mt-1 w-full rounded border border-slate-300 px-3 py-2"> </label> <label class="block"> <span class="text-sm font-medium">Password</span> <input name="password" type="password" required minlength="8" autocomplete="new-password" class="mt-1 w-full rounded border border-slate-300 px-3 py-2"> </label> <button type="submit" class="w-full rounded bg-accent px-4 py-2 font-medium text-white hover:bg-blue-700">
Create account
</button> </form> <p class="mt-6 text-sm text-ink-muted">
Already have one?
<a class="text-accent underline"${addAttribute(`/auth/login?next=${encodeURIComponent(next)}`, "href")}>Sign in</a> </p> </div> ` })}`;
}, "/Volumes/harmless_ssd/edu_web/src/pages/auth/signup.astro", void 0);

const $$file = "/Volumes/harmless_ssd/edu_web/src/pages/auth/signup.astro";
const $$url = "/auth/signup";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Signup,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
