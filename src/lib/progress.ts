import { getSupabaseBrowserClient } from './supabase/browser';

const LS_PROGRESS = 'edu_web:lesson_progress';
const LS_ATTEMPTS = 'edu_web:quiz_attempts';

type ProgressMap = Record<string, { status: 'started' | 'completed'; updatedAt: string }>;
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
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.from('lesson_progress').upsert({
      user_id: user.id,
      lesson_slug: lessonSlug,
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    });
  }

  const map = readLocal<ProgressMap>(LS_PROGRESS, {});
  map[lessonSlug] = { status, updatedAt: new Date().toISOString() };
  writeLocal(LS_PROGRESS, map);
}

export async function recordQuizAttempt(args: {
  quizSlug: string;
  score: number;
  maxScore: number;
  answers: unknown;
}) {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.from('quiz_attempts').insert({
      user_id: user.id,
      quiz_slug: args.quizSlug,
      score: args.score,
      max_score: args.maxScore,
      answers: args.answers as never,
    });
  }

  const log = readLocal<AttemptLog>(LS_ATTEMPTS, []);
  log.push({ ...args, submittedAt: new Date().toISOString() });
  writeLocal(LS_ATTEMPTS, log);
}

export function readLocalAttempts() {
  return readLocal<AttemptLog>(LS_ATTEMPTS, []);
}
