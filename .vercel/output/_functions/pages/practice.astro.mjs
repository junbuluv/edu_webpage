import { a8 as createComponent, al as renderComponent, at as renderTemplate, ai as maybeRenderHead, a4 as addAttribute } from '../chunks/astro/server_SoPnprkE.mjs';
import 'piccolore';
import { $ as $$BaseLayout } from '../chunks/BaseLayout_CHyyXfTC.mjs';
import { g as getCollection } from '../chunks/_astro_content_Bz8-wpf4.mjs';
export { renderers } from '../renderers.mjs';

const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const quizzes = await getCollection("quizzes");
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Practice" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="mx-auto max-w-3xl px-4 py-12"> <h1 class="text-3xl font-semibold tracking-tight">Practice quizzes</h1> <p class="mt-3 text-ink-muted">
Self-grading drills with worked explanations. Signed-in attempts are saved to your dashboard.
</p> <ul class="mt-8 space-y-3"> ${quizzes.map((q) => renderTemplate`<li class="rounded border border-slate-200 p-4 hover:border-accent"> <a${addAttribute(`/practice/${q.data.slug}`, "href")} class="flex items-baseline justify-between"> <span> <span class="font-medium">${q.data.title}</span> <span class="ml-3 text-xs uppercase tracking-wide text-ink-muted"> ${q.data.course} </span> </span> <span class="text-sm text-ink-muted"> ${q.data.questions.length} questions
</span> </a> </li>`)} </ul> </div> ` })}`;
}, "/Volumes/harmless_ssd/edu_web/src/pages/practice/index.astro", void 0);

const $$file = "/Volumes/harmless_ssd/edu_web/src/pages/practice/index.astro";
const $$url = "/practice";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
