import { useEffect, useState } from 'react';
import {
  markLessonStatus,
  readLocalLessonProgress,
  type LessonOperation,
  type LessonSaveResult,
  type LessonStatus,
  type LessonSyncState,
} from '@lib/progress';

interface Props {
  lessonSlug: string;
  initialStatus: LessonStatus | null;
  initialStatusKnown: boolean;
  signedIn: boolean;
}

const SYNC_MESSAGES: Partial<Record<LessonSyncState, string>> = {
  local: 'Progress is saved on this device.',
  queued:
    'Saved on this device. Sync is queued until you are signed in and online.',
  failed: 'Saved on this device, but progress did not sync.',
  ambiguous:
    'Saved on this device, but progress could not be assigned because multiple current enrollments match this course. Ask your instructor to repair the roster.',
  storage_failed:
    'This browser blocked local storage, and progress did not sync. Keep this page open and retry after checking your browser settings.',
};

function requestedStatus(operation: LessonOperation) {
  return operation === 'start'
    ? ('started' as const)
    : operation === 'complete'
      ? ('completed' as const)
      : ('reset' as const);
}

export default function LessonProgressButton({
  lessonSlug,
  initialStatus,
  initialStatusKnown,
  signedIn,
}: Props) {
  const [status, setStatus] = useState<LessonStatus>(
    initialStatus ?? 'started',
  );
  const [busy, setBusy] = useState(false);
  const [sync, setSync] = useState<LessonSyncState | null>(null);
  const [pendingOperation, setPendingOperation] =
    useState<LessonOperation | null>(null);

  function applyResult(result: LessonSaveResult) {
    setStatus(result.status);
    setSync(result.sync);
    setPendingOperation(result.pendingOperation ?? null);
  }

  useEffect(() => {
    const local = readLocalLessonProgress(lessonSlug);
    if (!signedIn && local) {
      setStatus(local.status);
      if (local.pendingOperation) {
        setSync('queued');
        setPendingOperation(local.pendingOperation);
      }
      return;
    }
    if (signedIn && local?.pendingOperation) {
      setStatus(local.status);
      setSync('queued');
      setPendingOperation(local.pendingOperation);
      void markLessonStatus(
        lessonSlug,
        requestedStatus(local.pendingOperation),
        { expectRemote: signedIn },
      ).then(applyResult);
      return;
    }
    if (!signedIn || (initialStatusKnown && initialStatus == null)) {
      void markLessonStatus(lessonSlug, 'started', {
        expectRemote: signedIn,
      }).then(applyResult);
    }
  }, [initialStatus, initialStatusKnown, lessonSlug, signedIn]);

  async function save(operation: LessonOperation) {
    setBusy(true);
    try {
      applyResult(
        await markLessonStatus(lessonSlug, requestedStatus(operation), {
          expectRemote: signedIn,
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  const done = status === 'completed';
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => save(done ? 'reset' : 'complete')}
          disabled={busy || (signedIn && !initialStatusKnown)}
          aria-pressed={done}
          className={`rounded border px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${
            done
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
              : 'border-slate-300 text-ink hover:border-accent'
          }`}
        >
          {busy
            ? 'Saving…'
            : done
              ? '✓ Completed · Mark incomplete'
              : 'Mark complete'}
        </button>
        {pendingOperation && (
          <button
            type="button"
            disabled={busy}
            onClick={() => save(pendingOperation)}
            className="rounded border border-amber-300 px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-60"
          >
            Retry sync
          </button>
        )}
      </div>
      {sync && SYNC_MESSAGES[sync] && (
        <p
          role={sync === 'failed' || sync === 'ambiguous' ? 'alert' : 'status'}
          aria-live="polite"
          className={`max-w-md text-xs ${
            sync === 'failed' || sync === 'ambiguous'
              ? 'text-amber-800'
              : 'text-ink-muted'
          }`}
        >
          {SYNC_MESSAGES[sync]}
        </p>
      )}
      {sync === 'terms_required' && (
        <p role="alert" className="max-w-md text-xs text-amber-800">
          Accept the current terms before syncing progress.{' '}
          <a className="font-medium underline" href="/account/terms">
            Review terms
          </a>
        </p>
      )}
      {signedIn && !initialStatusKnown && sync == null && (
        <p role="alert" className="max-w-md text-xs text-amber-800">
          Saved progress is temporarily unavailable. Refresh before changing
          this lesson status.
        </p>
      )}
    </div>
  );
}
