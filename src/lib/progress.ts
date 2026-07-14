import { getSupabaseBrowserClient } from './supabase/browser';

const LS_PROGRESS = 'edu_web:lesson_progress';
const LS_ATTEMPTS = 'edu_web:quiz_attempts';

type ProgressMap = Record<
  string,
  { status: 'started' | 'completed'; updatedAt: string }
>;
type AttemptLog = Array<{
  quizSlug: string;
  score: number;
  maxScore: number;
  answers: unknown;
  submittedAt: string;
}>;

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export async function markLessonStatus(
  lessonSlug: string,
  status: 'started' | 'completed',
) {
  const map = readLocal<ProgressMap>(LS_PROGRESS, {});
  map[lessonSlug] = { status, updatedAt: new Date().toISOString() };
  writeLocal(LS_PROGRESS, map);

  let user: { id: string } | null = null;
  try {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    return;
  }
  if (!user) return;

  try {
    await fetch('/api/progress/lesson', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lessonSlug, status }),
    });
  } catch {
    // The local record remains available if the network is temporarily down.
  }
}

export async function recordQuizAttempt(args: {
  quizSlug: string;
  score: number;
  maxScore: number;
  answers: unknown;
}) {
  const log = readLocal<AttemptLog>(LS_ATTEMPTS, []);
  log.push({ ...args, submittedAt: new Date().toISOString() });
  writeLocal(LS_ATTEMPTS, log);
}

export function readLocalAttempts() {
  return readLocal<AttemptLog>(LS_ATTEMPTS, []);
}
