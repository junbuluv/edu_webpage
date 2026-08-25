const LS_PROGRESS = 'edu_web:lesson_progress';
const LS_ATTEMPTS = 'edu_web:quiz_attempts';
const MAX_LOCAL_ATTEMPTS = 200;

export type LessonStatus = 'started' | 'completed';
export type LessonOperation = 'start' | 'complete' | 'reset';
export type LessonSyncState =
  | 'saved'
  | 'local'
  | 'queued'
  | 'failed'
  | 'ambiguous'
  | 'terms_required'
  | 'storage_failed';

export type LessonSaveResult = {
  status: LessonStatus;
  sync: LessonSyncState;
  pendingOperation?: LessonOperation;
};

type ProgressEntry = {
  status: LessonStatus;
  updatedAt: string;
  pendingOperation?: LessonOperation;
};
type ProgressMap = Record<string, ProgressEntry>;
type AttemptLog = Array<{
  attemptId: string;
  quizSlug: string;
  score: number;
  maxScore: number;
  answers: unknown;
  syncState: string;
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

function writeLocal<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function statusForOperation(
  operation: LessonOperation,
  current: LessonStatus | undefined,
): LessonStatus {
  if (operation === 'complete') return 'completed';
  if (operation === 'reset') return 'started';
  return current === 'completed' ? 'completed' : 'started';
}

function writeLessonEntry(
  lessonSlug: string,
  status: LessonStatus,
  pendingOperation?: LessonOperation,
): boolean {
  const map = readLocal<ProgressMap>(LS_PROGRESS, {});
  map[lessonSlug] = {
    status,
    updatedAt: new Date().toISOString(),
    ...(pendingOperation ? { pendingOperation } : {}),
  };
  return writeLocal(LS_PROGRESS, map);
}

export function readLocalLessonProgress(
  lessonSlug: string,
): ProgressEntry | null {
  return readLocal<ProgressMap>(LS_PROGRESS, {})[lessonSlug] ?? null;
}

export async function markLessonStatus(
  lessonSlug: string,
  requested: 'started' | 'completed' | 'reset',
  options: { expectRemote?: boolean } = {},
): Promise<LessonSaveResult> {
  const operation: LessonOperation =
    requested === 'started'
      ? 'start'
      : requested === 'completed'
        ? 'complete'
        : 'reset';
  const currentEntry = readLocalLessonProgress(lessonSlug);
  const current = currentEntry?.status;
  const optimisticStatus = statusForOperation(operation, current);
  const shouldQueue =
    options.expectRemote === true || currentEntry?.pendingOperation != null;
  let localSaved = writeLessonEntry(
    lessonSlug,
    optimisticStatus,
    shouldQueue ? operation : undefined,
  );

  // Whether the visitor is signed in is decided server-side (the session
  // lives in httpOnly cookies the browser Supabase client cannot read, so
  // asking it auth.getUser() here always returned null and silently kept
  // signed-in progress local-only). Trust the caller's expectRemote flag —
  // it comes from Astro.locals.user — and let /api/progress/lesson
  // authenticate via the request cookies. A 401 below means the session
  // expired mid-visit; the operation stays queued for retry.
  if (!options.expectRemote && !shouldQueue) {
    return {
      status: optimisticStatus,
      sync: localSaved ? 'local' : 'storage_failed',
    };
  }

  let response: Response;
  try {
    response = await fetch('/api/progress/lesson', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lessonSlug, operation }),
    });
  } catch {
    localSaved = writeLessonEntry(lessonSlug, optimisticStatus, operation);
    return {
      status: optimisticStatus,
      sync: localSaved ? 'queued' : 'storage_failed',
      pendingOperation: operation,
    };
  }

  const body = (await response.json().catch(() => null)) as {
    status?: unknown;
    error?: unknown;
    reason?: unknown;
  } | null;
  if (!response.ok) {
    localSaved = writeLessonEntry(lessonSlug, optimisticStatus, operation);
    const termsRequired =
      response.status === 428 &&
      (body?.reason === 'terms_acceptance_required' ||
        body?.error === 'terms_acceptance_required');
    return {
      status: optimisticStatus,
      sync: termsRequired
        ? 'terms_required'
        : response.status === 409
          ? 'ambiguous'
          : localSaved
            ? 'failed'
            : 'storage_failed',
      pendingOperation: operation,
    };
  }

  const savedStatus: LessonStatus =
    body?.status === 'completed' ? 'completed' : 'started';
  writeLessonEntry(lessonSlug, savedStatus);
  return { status: savedStatus, sync: 'saved' };
}

export async function recordQuizAttempt(args: {
  attemptId: string;
  quizSlug: string;
  score: number;
  maxScore: number;
  answers: unknown;
  syncState: string;
}) {
  const log = readLocal<AttemptLog>(LS_ATTEMPTS, []);
  const existingIndex = log.findIndex(
    (attempt) => attempt.attemptId === args.attemptId,
  );
  const entry = { ...args, submittedAt: new Date().toISOString() };
  if (existingIndex >= 0) log[existingIndex] = entry;
  else log.push(entry);
  if (!writeLocal(LS_ATTEMPTS, log.slice(-MAX_LOCAL_ATTEMPTS))) {
    throw new Error('Local quiz history is unavailable.');
  }
}

export function readLocalAttempts() {
  return readLocal<AttemptLog>(LS_ATTEMPTS, []);
}
