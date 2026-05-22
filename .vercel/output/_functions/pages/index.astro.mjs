import { a8 as createComponent, al as renderComponent, at as renderTemplate, ai as maybeRenderHead, a4 as addAttribute } from '../chunks/astro/server_SoPnprkE.mjs';
import 'piccolore';
import { $ as $$BaseLayout } from '../chunks/BaseLayout_CHyyXfTC.mjs';
import { g as getCollection } from '../chunks/_astro_content_Bz8-wpf4.mjs';
export { renderers } from '../renderers.mjs';

const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const lessons = (await getCollection("lessons", (l) => !l.data.draft)).sort((a, b) => a.data.order - b.data.order);
  const macro = lessons.filter((l) => l.data.course === "macro");
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Econ Studio" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50"> <div class="mx-auto max-w-4xl px-4 py-20 text-center"> <h1 class="text-4xl font-semibold tracking-tight md:text-5xl">
Economics & Finance you can <span class="text-accent">play with</span>.
</h1> <p class="mx-auto mt-5 max-w-2xl text-lg text-ink-muted">
Interactive lessons, calibrated visualizations, and short quizzes
        designed for undergraduate econ and finance courses. Drag a slider,
        watch the curves move, then test yourself.
</p> <div class="mt-8 flex justify-center gap-3"> <a href="/macro" class="rounded bg-accent px-5 py-2.5 font-medium text-white">
Start with Macroeconomics
</a> <a href="/practice" class="rounded border border-slate-300 px-5 py-2.5 font-medium">
Browse practice
</a> </div> </div> </section> <section class="mx-auto max-w-5xl px-4 py-16"> <h2 class="text-2xl font-semibold">Macroeconomics</h2> <p class="text-ink-muted mt-2">
Short, calibrated lessons covering the core undergraduate sequence.
</p> <ul class="mt-6 grid gap-4 md:grid-cols-2"> ${macro.map((l) => renderTemplate`<li class="rounded-lg border border-slate-200 bg-white p-5 hover:border-accent transition"> <a${addAttribute(`/lessons/${l.slug}`, "href")} class="block"> <p class="text-xs uppercase tracking-wide text-accent font-medium"> ${l.data.unit} </p> <h3 class="mt-1 text-lg font-semibold">${l.data.title}</h3> <p class="mt-1 text-sm text-ink-muted">${l.data.summary}</p> <p class="mt-3 text-xs text-ink-muted">⏱ ${l.data.estimatedMinutes} min</p> </a> </li>`)} </ul> </section> ` })}`;
}, "/Volumes/harmless_ssd/edu_web/src/pages/index.astro", void 0);

const $$file = "/Volumes/harmless_ssd/edu_web/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
