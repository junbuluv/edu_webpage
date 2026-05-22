import { a8 as createComponent, al as renderComponent, at as renderTemplate, ai as maybeRenderHead, a4 as addAttribute } from '../chunks/astro/server_SoPnprkE.mjs';
import 'piccolore';
import { $ as $$BaseLayout } from '../chunks/BaseLayout_CHyyXfTC.mjs';
import { g as getCollection } from '../chunks/_astro_content_Bz8-wpf4.mjs';
export { renderers } from '../renderers.mjs';

const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const lessons = (await getCollection("lessons", (l) => !l.data.draft && l.data.course === "macro")).sort((a, b) => a.data.order - b.data.order);
  const byUnit = /* @__PURE__ */ new Map();
  for (const l of lessons) {
    const arr = byUnit.get(l.data.unit) ?? [];
    arr.push(l);
    byUnit.set(l.data.unit, arr);
  }
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Macroeconomics" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="mx-auto max-w-4xl px-4 py-12"> <h1 class="text-3xl font-semibold tracking-tight">Macroeconomics</h1> <p class="mt-3 text-ink-muted">
The undergraduate macro sequence in interactive form: short-run output
      determination, money and interest, growth, and inflation.
</p> ${[...byUnit.entries()].map(([unit, items]) => renderTemplate`<section class="mt-10"> <h2 class="text-xl font-semibold">${unit}</h2> <ol class="mt-4 space-y-2"> ${items.map((l) => renderTemplate`<li> <a${addAttribute(`/lessons/${l.slug}`, "href")} class="flex items-baseline justify-between rounded border border-slate-200 px-4 py-3 hover:border-accent"> <span class="font-medium">${l.data.title}</span> <span class="text-sm text-ink-muted">⏱ ${l.data.estimatedMinutes} min</span> </a> </li>`)} </ol> </section>`)} </div> ` })}`;
}, "/Volumes/harmless_ssd/edu_web/src/pages/macro/index.astro", void 0);

const $$file = "/Volumes/harmless_ssd/edu_web/src/pages/macro/index.astro";
const $$url = "/macro";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
