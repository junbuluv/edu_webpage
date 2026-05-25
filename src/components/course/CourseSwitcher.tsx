import { useEffect, useRef, useState } from 'react';

export interface CourseOption {
  slug: string;
  code: string;
  title: string;
  enrolled: boolean;
}

interface Props {
  courses: CourseOption[];
  activeSlug: string | null;
}

export default function CourseSwitcher({ courses, activeSlug }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeydown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeydown);
    };
  }, [open]);

  if (courses.length === 0) return null;

  const active = courses.find((c) => c.slug === activeSlug) ?? null;
  const buttonLabel = active ? active.code : 'Pick a course';

  async function pick(slug: string) {
    if (slug === activeSlug) {
      setOpen(false);
      return;
    }
    setSubmitting(slug);
    setError(null);
    try {
      const resp = await fetch('/api/profile/active-course', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ course_slug: slug }),
      });
      const data = (await resp.json()) as {
        ok: boolean;
        redirectTo?: string;
        reason?: string;
        detail?: string;
      };
      if (!data.ok || !data.redirectTo) {
        // Prefer the detail field (real server error text); fall back to
        // the high-level reason.
        const msg = data.detail
          ? `${data.reason ?? 'Failed'}: ${data.detail}`
          : (data.reason ?? 'Could not switch course.');
        setError(msg);
        setSubmitting(null);
        return;
      }
      window.location.href = data.redirectTo;
    } catch (e) {
      setError(`Network error: ${(e as Error).message}`);
      setSubmitting(null);
    }
  }

  return (
    <div ref={rootRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:border-accent"
      >
        <span>{buttonLabel}</span>
        <svg
          aria-hidden="true"
          className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          fill="currentColor"
        >
          <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-20 mt-1 w-64 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {courses.map((c) => {
            const isActive = c.slug === activeSlug;
            const isLoading = submitting === c.slug;
            return (
              <button
                key={c.slug}
                role="option"
                aria-selected={isActive}
                disabled={isLoading || submitting !== null}
                onClick={() => pick(c.slug)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50 ${
                  isActive ? 'bg-slate-50' : ''
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.code}</span>
                    {isActive && (
                      <span className="text-xs text-ink-muted">(current)</span>
                    )}
                  </div>
                  <div className="text-xs text-ink-muted">{c.title}</div>
                </div>
                {isLoading && (
                  <span className="text-xs text-ink-muted">...</span>
                )}
              </button>
            );
          })}
          {error && (
            <div className="border-t border-slate-200 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
