import { a7 as createAstro, a8 as createComponent, al as renderComponent, at as renderTemplate, ai as maybeRenderHead, a4 as addAttribute } from '../chunks/astro/server_SoPnprkE.mjs';
import 'piccolore';
import { $ as $$BaseLayout } from '../chunks/BaseLayout_CHyyXfTC.mjs';
export { renderers } from '../renderers.mjs';

const $$Astro = createAstro("https://edu.example.com");
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Index;
  const user = Astro2.locals.user;
  const supabase = Astro2.locals.supabase;
  const [{ data: progress }, { data: attempts }] = await Promise.all([
    supabase.from("lesson_progress").select("lesson_slug, status, updated_at, completed_at").order("updated_at", { ascending: false }),
    supabase.from("quiz_attempts").select("quiz_slug, score, max_score, submitted_at").order("submitted_at", { ascending: false }).limit(20)
  ]);
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Dashboard" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="mx-auto max-w-4xl px-4 py-12"> <h1 class="text-3xl font-semibold tracking-tight">Your dashboard</h1> <p class="mt-2 text-ink-muted">Signed in as ${user.email}</p> <section class="mt-10"> <h2 class="text-xl font-semibold">Lesson progress</h2> ${progress && progress.length > 0 ? renderTemplate`<ul class="mt-4 divide-y divide-slate-200 rounded border border-slate-200"> ${progress.map((p) => renderTemplate`<li class="flex items-baseline justify-between px-4 py-3"> <a${addAttribute(`/lessons/${p.lesson_slug}`, "href")} class="text-accent underline"> ${p.lesson_slug} </a> <span${addAttribute(`text-sm ${p.status === "completed" ? "text-emerald-700" : "text-ink-muted"}`, "class")}> ${p.status} </span> </li>`)} </ul>` : renderTemplate`<p class="mt-2 text-ink-muted">No lessons started yet.</p>`} </section> <section class="mt-10"> <h2 class="text-xl font-semibold">Recent quiz attempts</h2> ${attempts && attempts.length > 0 ? renderTemplate`<ul class="mt-4 divide-y divide-slate-200 rounded border border-slate-200"> ${attempts.map((a) => renderTemplate`<li class="flex items-baseline justify-between px-4 py-3"> <a${addAttribute(`/practice/${a.quiz_slug}`, "href")} class="text-accent underline"> ${a.quiz_slug} </a> <span class="text-sm text-ink-muted"> ${a.score} / ${a.max_score} · ${new Date(a.submitted_at).toLocaleDateString()} </span> </li>`)} </ul>` : renderTemplate`<p class="mt-2 text-ink-muted">No quiz attempts yet.</p>`} </section> </div> ` })}`;
}, "/Volumes/harmless_ssd/edu_web/src/pages/dashboard/index.astro", void 0);

const $$file = "/Volumes/harmless_ssd/edu_web/src/pages/dashboard/index.astro";
const $$url = "/dashboard";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
