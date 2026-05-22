import { useEffect, useState } from 'react';
import { markLessonStatus } from '@lib/progress';

interface Props {
  lessonSlug: string;
}

export default function LessonProgressButton({ lessonSlug }: Props) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const map = JSON.parse(
        window.localStorage.getItem('edu_web:lesson_progress') ?? '{}',
      );
      if (map?.[lessonSlug]?.status === 'completed') setDone(true);
    } catch {
      /* ignore */
    }
    void markLessonStatus(lessonSlug, 'started');
  }, [lessonSlug]);

  async function toggle() {
    setBusy(true);
    try {
      const next = done ? 'started' : 'completed';
      await markLessonStatus(lessonSlug, next);
      setDone(!done);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`rounded border px-4 py-2 text-sm font-medium transition ${
        done
          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
          : 'border-slate-300 text-ink hover:border-accent'
      }`}
    >
      {done ? '✓ Marked complete' : 'Mark complete'}
    </button>
  );
}
