import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import {
  PAPER_UPLOAD_BUCKET,
  PAPER_UPLOAD_MAX_BYTES,
  resolvePaperContentType,
  type PaperContentType,
} from '../../lib/archive/paper-upload';
import { getSupabaseBrowserClient } from '../../lib/supabase/browser';

interface Props {
  courses: string[];
  prefillCourse?: string;
  defaultYear: number;
}

type Phase = 'idle' | 'preparing' | 'uploading' | 'verifying';

interface ApiResult {
  ok?: boolean;
  reason?: string;
  upload?: {
    intent_id?: string;
    path?: string;
    token?: string;
  };
}

interface PendingFinalize {
  intentId: string;
  path: string;
}

interface PendingStorageUpload extends PendingFinalize {
  token: string;
  file: File;
  contentType: PaperContentType;
}

const ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: 'Your session expired. Sign in again and retry.',
  forbidden: 'You do not have permission to upload archive files.',
  not_course_instructor: 'You are not an instructor for that course.',
  invalid_payload: 'The upload details could not be read. Refresh and retry.',
  invalid_course: 'Choose a valid course.',
  invalid_input: 'Check the title, kind, term, and year.',
  invalid_lesson: 'One of the selected lessons is not valid for that course.',
  missing_file: 'Choose a PDF or Word file.',
  bad_file_name: 'Use a file name without slashes or control characters.',
  bad_file_type: 'Only genuine PDF or Word (.docx) files are allowed.',
  file_too_large: 'The file is too large. The maximum is 25 MB.',
  invalid_upload_path: 'The prepared upload expired or is invalid. Retry.',
  upload_intent_not_found:
    'This prepared upload no longer exists. Select the file and start again.',
  upload_failed: 'The file could not be uploaded. Check your connection.',
  storage_upload_retry:
    'The secure storage upload did not finish. Retry this upload without creating a new one.',
  storage_verification_failed:
    'The uploaded file could not be verified. Please retry.',
  file_mismatch: 'The uploaded file did not match the selected file.',
  insert_failed: 'The file uploaded, but its archive entry could not be saved.',
  too_many_pending_uploads:
    'Too many uploads are waiting to finish. Retry an earlier upload or wait for it to expire.',
  upload_expired:
    'This secure upload expired. Select the file and start again.',
  network_error:
    'The server response was lost. Retry verification without uploading again.',
  invalid_response:
    'The server response could not be confirmed. Retry verification without uploading again.',
};

class UploadError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

async function postJson(
  url: string,
  payload: Record<string, unknown>,
): Promise<ApiResult> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new UploadError('network_error');
  }

  let result: ApiResult;
  try {
    result = (await response.json()) as ApiResult;
  } catch {
    throw new UploadError('invalid_response');
  }
  if (!response.ok || !result.ok) {
    throw new UploadError(result.reason ?? 'upload_failed');
  }
  return result;
}

export default function PaperUploadForm({
  courses,
  prefillCourse = '',
  defaultYear,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pendingFinalize, setPendingFinalize] =
    useState<PendingFinalize | null>(null);
  const [pendingStorageUpload, setPendingStorageUpload] =
    useState<PendingStorageUpload | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const pending = phase !== 'idle';
  const locked =
    pending || pendingFinalize !== null || pendingStorageUpload !== null;

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function finalizeUpload(
    upload: PendingFinalize,
    storageFallback: PendingStorageUpload | null = null,
  ) {
    if (pending) return;
    if (storageFallback) setPendingStorageUpload(null);
    setError(null);
    setPhase('verifying');
    try {
      await postJson('/api/instructor/archive/paper/finalize', {
        intent_id: upload.intentId,
        path: upload.path,
      });
      window.location.assign('/instructor/archive?ok=paper_created');
    } catch (caught) {
      const reason =
        caught instanceof UploadError ? caught.reason : 'network_error';
      const canRetry = new Set([
        'network_error',
        'invalid_response',
        'storage_verification_failed',
        'insert_failed',
      ]).has(reason);
      if (storageFallback && canRetry) {
        setPendingFinalize(null);
        setPendingStorageUpload(storageFallback);
        setError(ERROR_MESSAGES.storage_upload_retry);
      } else {
        setPendingFinalize(canRetry ? upload : null);
        setError(
          ERROR_MESSAGES[reason] ??
            'The uploaded file could not be verified. Please try again.',
        );
      }
      setPhase('idle');
    }
  }

  async function uploadPrepared(upload: PendingStorageUpload) {
    if (pending) return;
    setError(null);
    setPhase('uploading');
    try {
      const { error: storageError } = await getSupabaseBrowserClient()
        .storage.from(PAPER_UPLOAD_BUCKET)
        .uploadToSignedUrl(upload.path, upload.token, upload.file, {
          contentType: upload.contentType,
          cacheControl: '3600',
          upsert: false,
        });
      if (storageError) throw storageError;

      setPendingStorageUpload(null);
      const uploaded = { intentId: upload.intentId, path: upload.path };
      setPendingFinalize(uploaded);
      setPhase('idle');
      await finalizeUpload(uploaded);
    } catch {
      setPhase('idle');
      await finalizeUpload(
        { intentId: upload.intentId, path: upload.path },
        upload,
      );
    }
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || pendingFinalize || pendingStorageUpload) return;
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const selected = data.get('file');
    if (!(selected instanceof File) || selected.size === 0) {
      setError(ERROR_MESSAGES.missing_file);
      return;
    }
    const contentType = resolvePaperContentType(selected.name, selected.type);
    if (!contentType) {
      setError(ERROR_MESSAGES.bad_file_type);
      return;
    }
    if (selected.size > PAPER_UPLOAD_MAX_BYTES) {
      setError(ERROR_MESSAGES.file_too_large);
      return;
    }

    const metadata = {
      course_slug: String(data.get('course_slug') ?? ''),
      kind: String(data.get('kind') ?? ''),
      title: String(data.get('title') ?? ''),
      semester_term: String(data.get('semester_term') ?? ''),
      semester_year: Number(data.get('semester_year')),
      covers: data.getAll('covers').map(String),
      file_name: selected.name,
      content_type: contentType,
      size_bytes: selected.size,
    };

    try {
      setPhase('preparing');
      const prepared = await postJson(
        '/api/instructor/archive/paper/prepare',
        metadata,
      );
      const path = prepared.upload?.path;
      const token = prepared.upload?.token;
      const intentId = prepared.upload?.intent_id;
      if (!path || !token || !intentId) {
        throw new UploadError('invalid_response');
      }

      const uploadBody =
        selected.type === contentType
          ? selected
          : new File([selected], selected.name, {
              type: contentType,
              lastModified: selected.lastModified,
            });
      const preparedUpload = {
        intentId,
        path,
        token,
        file: uploadBody,
        contentType,
      };
      setPendingStorageUpload(preparedUpload);
      setPhase('idle');
      await uploadPrepared(preparedUpload);
    } catch (caught) {
      const caughtReason =
        caught instanceof UploadError ? caught.reason : 'upload_failed';
      const reason = ['network_error', 'invalid_response'].includes(
        caughtReason,
      )
        ? 'upload_failed'
        : caughtReason;
      setError(
        ERROR_MESSAGES[reason] ??
          'The file could not be uploaded. Please try again.',
      );
      setPhase('idle');
    }
  }

  const selectedCourse = courses.includes(prefillCourse)
    ? prefillCourse
    : courses[0];
  const status =
    phase === 'preparing'
      ? 'Preparing a secure upload…'
      : phase === 'uploading'
        ? 'Uploading directly to secure storage…'
        : phase === 'verifying'
          ? 'Verifying and saving the archive entry…'
          : null;

  return (
    <form
      onSubmit={submit}
      className="mt-4 space-y-3 rounded-lg border border-slate-200 p-5 text-sm"
      aria-busy={pending}
    >
      <h3 className="font-medium">Upload a file</h3>
      <label className="block">
        <span className="text-ink-muted">Course</span>
        <select
          name="course_slug"
          required
          defaultValue={selectedCourse}
          disabled={locked}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        >
          {courses.map((course) => (
            <option key={course} value={course}>
              {course}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-ink-muted">Kind</span>
        <select
          name="kind"
          required
          disabled={locked}
          className="mt-1 rounded border border-slate-300 px-2 py-1"
        >
          <option value="exam">Exam</option>
          <option value="assignment">Assignment</option>
        </select>
      </label>
      <label className="block">
        <span className="text-ink-muted">Title</span>
        <input
          name="title"
          required
          maxLength={200}
          disabled={locked}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <div className="flex gap-3">
        <label className="block">
          <span className="text-ink-muted">Term</span>
          <select
            name="semester_term"
            required
            disabled={locked}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          >
            <option value="spring">Spring</option>
            <option value="summer">Summer</option>
            <option value="fall">Fall</option>
          </select>
        </label>
        <label className="block">
          <span className="text-ink-muted">Year</span>
          <input
            name="semester_year"
            type="number"
            min={2020}
            max={2100}
            defaultValue={defaultYear}
            required
            disabled={locked}
            className="mt-1 w-28 rounded border border-slate-300 px-2 py-1"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-ink-muted">File (PDF or .docx)</span>
        <input
          name="file"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
          disabled={locked}
          className="mt-1 block w-full text-sm"
        />
      </label>
      <button
        type={pendingFinalize || pendingStorageUpload ? 'button' : 'submit'}
        disabled={pending}
        onClick={
          pendingStorageUpload
            ? () => void uploadPrepared(pendingStorageUpload)
            : pendingFinalize
              ? () => void finalizeUpload(pendingFinalize)
              : undefined
        }
        className="rounded bg-accent px-3 py-1.5 font-medium text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
      >
        {pending
          ? 'Uploading…'
          : pendingStorageUpload
            ? 'Retry secure upload'
            : pendingFinalize
              ? 'Retry verification'
              : 'Upload'}
      </button>
      {status && (
        <p role="status" aria-live="polite" className="text-sm text-ink-muted">
          {status}
        </p>
      )}
      {error && (
        <p
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900 outline-none focus:ring-2 focus:ring-amber-500"
        >
          {error}
        </p>
      )}
      <p className="text-xs text-ink-muted">
        Files upload directly to private storage. Link lessons to this paper
        later by editing it. Covers default to none, and new files remain hidden
        until you review and publish them.
      </p>
    </form>
  );
}
