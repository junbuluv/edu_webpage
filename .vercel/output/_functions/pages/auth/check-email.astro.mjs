import { a7 as createAstro, a8 as createComponent, al as renderComponent, at as renderTemplate, ai as maybeRenderHead } from '../../chunks/astro/server_SoPnprkE.mjs';
import 'piccolore';
import { $ as $$BaseLayout } from '../../chunks/BaseLayout_CHyyXfTC.mjs';
export { renderers } from '../../renderers.mjs';

const $$Astro = createAstro("https://edu.example.com");
const $$CheckEmail = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$CheckEmail;
  const email = Astro2.url.searchParams.get("email") ?? "your inbox";
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Check your email" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="mx-auto max-w-md py-16"> <h1 class="text-2xl font-semibold mb-4">Check your email</h1> <p class="text-ink-muted">
We sent a confirmation link to <strong>${email}</strong>. Click it to
      finish creating your account.
</p> </div> ` })}`;
}, "/Volumes/harmless_ssd/edu_web/src/pages/auth/check-email.astro", void 0);

const $$file = "/Volumes/harmless_ssd/edu_web/src/pages/auth/check-email.astro";
const $$url = "/auth/check-email";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$CheckEmail,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
