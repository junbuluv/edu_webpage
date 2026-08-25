import { useEffect, useRef, useState } from 'react';

interface SidebarLesson {
  slug: string;
  title: string;
}

interface SidebarUnit {
  unit: string;
  lessons: SidebarLesson[];
}

interface Props {
  units: SidebarUnit[];
  currentSlug: string;
  courseCode: string;
  courseHref: string;
  serverCompleted: string[];
}

const LS_PROGRESS = 'edu_web:lesson_progress';

function readLocalCompleted(): string[] {
  try {
    const map = JSON.parse(window.localStorage.getItem(LS_PROGRESS) ?? '{}');
    return Object.keys(map).filter((k) => map[k]?.status === 'completed');
  } catch {
    return [];
  }
}

export default function LessonSidebar({
  units,
  currentSlug,
  courseCode,
  courseHref,
  serverCompleted,
}: Props) {
  const [completed, setCompleted] = useState<Set<string>>(
    () => new Set(serverCompleted),
  );
  const [open, setOpen] = useState(false);
  const currentRef = useRef<HTMLAnchorElement>(null);

  // Merge anonymous/local progress after hydration so SSR markup and the
  // first client render agree (localStorage is unavailable during SSR).
  useEffect(() => {
    const local = readLocalCompleted();
    if (local.length > 0) {
      setCompleted((prev) => new Set([...prev, ...local]));
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' });
  }, []);

  const tree = (
    <nav aria-label="Course lessons">
      <a
        href={courseHref}
        className="block px-3 pb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted hover:text-accent"
      >
        {courseCode} · all lessons
      </a>
      {units.map((u) => (
        <section key={u.unit} className="mb-4">
          <h3 className="px-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {u.unit}
          </h3>
          <ul className="mt-1">
            {u.lessons.map((l) => {
              const isCurrent = l.slug === currentSlug;
              const isDone = completed.has(l.slug);
              return (
                <li key={l.slug}>
                  <a
                    href={`/lessons/${l.slug}`}
                    ref={isCurrent ? currentRef : undefined}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`flex items-start gap-2 rounded px-3 py-1.5 text-sm transition ${
                      isCurrent
                        ? 'bg-accent/10 font-medium text-accent'
                        : 'text-ink hover:bg-slate-100'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 w-4 shrink-0 text-center text-xs ${
                        isDone ? 'text-emerald-600' : 'text-slate-300'
                      }`}
                    >
                      {isDone ? '✓' : '·'}
                    </span>
                    <span>
                      {l.title}
                      {isDone && <span className="sr-only"> (completed)</span>}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop: fixed column rendered by the layout's grid */}
      <div className="hidden lg:block">
        <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto pb-6 pr-2">
          {tree}
        </div>
      </div>

      {/* Mobile: floating button + slide-over drawer */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className="fixed bottom-4 left-4 z-40 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-lg"
        >
          ☰ Lessons
        </button>
        {open && (
          <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
            <button
              type="button"
              aria-label="Close lesson list"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-slate-900/40"
            />
            <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto bg-white p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Lessons</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded px-2 py-1 text-sm text-ink-muted hover:bg-slate-100"
                >
                  ✕ Close
                </button>
              </div>
              {tree}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
