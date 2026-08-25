import { useId, useState } from 'react';

export interface CourseOption {
  slug: string;
  code: string;
  title: string;
  enrolled: boolean;
}

interface Props {
  courses: CourseOption[];
  activeSlug: string | null;
  staffViewer?: boolean;
  wide?: boolean;
}

export default function CourseSwitcher({
  courses,
  activeSlug,
  staffViewer = false,
  wide = false,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsRequired, setTermsRequired] = useState(false);
  const errorId = useId();

  if (courses.length === 0) return null;

  async function pick(slug: string) {
    if (!slug || slug === activeSlug) return;
    setSubmitting(true);
    setError(null);
    setTermsRequired(false);
    try {
      const response = await fetch('/api/profile/active-course', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ course_slug: slug }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        redirectTo?: string;
        reason?: string;
      };
      if (!response.ok || !data.ok || !data.redirectTo) {
        const needsTerms =
          response.status === 428 &&
          data.reason === 'terms_acceptance_required';
        setTermsRequired(needsTerms);
        setError(
          needsTerms
            ? 'Accept the current terms before switching courses.'
            : data.reason === 'unauthenticated'
              ? 'Your session expired. Sign in again to switch courses.'
              : data.reason === 'invalid_course_slug'
                ? 'That course is no longer available.'
                : 'Could not switch course. Please retry.',
        );
        setSubmitting(false);
        return;
      }
      window.location.assign(data.redirectTo);
    } catch {
      setError('Could not switch course. Check your connection and retry.');
      setSubmitting(false);
    }
  }

  return (
    <div className="relative">
      <label>
        <span className="sr-only">Active course</span>
        <select
          value={activeSlug ?? ''}
          disabled={submitting}
          onChange={(event) => void pick(event.target.value)}
          aria-describedby={error ? errorId : undefined}
          className={`${wide ? 'w-full' : 'max-w-36'} rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium disabled:opacity-60`}
        >
          {!activeSlug && <option value="">Pick a course</option>}
          {courses.map((course) => (
            <option key={course.slug} value={course.slug}>
              {course.code}
              {course.enrolled ? '' : staffViewer ? ' (staff)' : ' (browse)'}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p
          id={errorId}
          role="alert"
          className={`${wide ? 'mt-1' : 'absolute right-0 z-20 mt-1 w-64'} rounded border border-rose-200 bg-white p-2 text-xs text-rose-700 shadow`}
        >
          {error}
          {termsRequired && (
            <>
              {' '}
              <a className="font-medium underline" href="/account/terms">
                Review terms
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
