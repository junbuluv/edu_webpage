// Lesson tutor panel (2026-10-05 design): a floating button that opens a
// side panel (a bottom sheet on phones) for coach-mode chat grounded in the
// current lesson. LessonLayout renders it only for enrolled students and
// staff when the course has `tutor: true` and the gateway key is set. The
// conversation lives in memory and resets on navigation; nothing is stored.
// Imports only client-safe tutor modules (limits, errors, math-delims).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import TutorMarkdown from './TutorMarkdown';
import {
  isRetryable,
  parseTutorError,
  TUTOR_ERROR_COPY,
} from '@lib/tutor/errors';
import {
  TUTOR_HISTORY_LIMIT,
  TUTOR_MAX_MESSAGE_CHARS,
} from '@lib/tutor/limits';
import { remainingFromMessages } from '@lib/tutor/remaining';

interface Props {
  lessonSlug: string;
  lessonTitle: string;
  dailyLimit: number;
  initialRemaining: number;
}

export default function TutorPanel({
  lessonSlug,
  lessonTitle,
  dailyLimit,
  initialRemaining,
}: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/tutor/chat',
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { lessonSlug, messages: messages.slice(-TUTOR_HISTORY_LIMIT) },
        }),
      }),
    [lessonSlug],
  );
  const { messages, sendMessage, status, error, stop, regenerate } = useChat({
    transport,
  });

  const errorCode = error ? parseTutorError(error.message) : null;
  // The server puts its exact count on each finished reply; the daily cap in
  // the database stays the authority.
  const remaining =
    errorCode === 'rate_limited'
      ? 0
      : remainingFromMessages(messages, initialRemaining);
  const busy = status === 'submitted' || status === 'streaming';
  const canSend = !busy && remaining > 0 && input.trim() !== '';

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, status]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function submit() {
    if (!canSend) return;
    void sendMessage({ text: input.trim() });
    setInput('');
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        aria-controls="tutor-panel"
        className="fixed bottom-5 right-5 z-40 rounded-full bg-accent px-5 py-3 font-medium text-white shadow-lg hover:bg-accent-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        Ask the tutor
      </button>
    );
  }

  return (
    <section
      id="tutor-panel"
      role="dialog"
      aria-label={`Tutor for ${lessonTitle}`}
      className="fixed inset-x-0 bottom-0 z-40 flex h-[85vh] flex-col border-t border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[36rem] sm:w-[26rem] sm:rounded-lg sm:border"
    >
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-heading">Tutor</p>
          <p className="text-xs text-ink-muted">{lessonTitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded px-2 py-1 text-sm text-ink-muted hover:bg-slate-100"
        >
          Close
        </button>
      </header>

      <div
        className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm text-ink"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="space-y-2 text-ink-muted">
            <p>
              I'm a study coach for this lesson. Ask about a concept, or show me
              your attempt at a problem and I'll help you work through it.
            </p>
            <p className="text-xs">
              Messages go to an AI provider through Vercel to generate replies.
              Don't include personal information.
            </p>
          </div>
        )}
        {messages.map((m) => {
          const text = m.parts
            .map((p) => (p.type === 'text' ? p.text : ''))
            .join('');
          return m.role === 'user' ? (
            <div
              key={m.id}
              className="ml-8 whitespace-pre-wrap break-words rounded-lg bg-brand-mist px-3 py-2"
            >
              {text}
            </div>
          ) : (
            <div key={m.id} className="mr-4">
              <TutorMarkdown text={text} />
            </div>
          );
        })}
        {status === 'submitted' && <p className="text-ink-muted">Thinking…</p>}
        {errorCode && (
          <div
            role="alert"
            className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900"
          >
            <p>{TUTOR_ERROR_COPY[errorCode]}</p>
            {isRetryable(errorCode) && (
              <button
                type="button"
                onClick={() => void regenerate()}
                className="mt-2 font-medium underline"
              >
                Try again
              </button>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="border-t border-slate-200 px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="tutor-input" className="sr-only">
          Message the tutor
        </label>
        <textarea
          id="tutor-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          maxLength={TUTOR_MAX_MESSAGE_CHARS}
          rows={2}
          disabled={remaining === 0}
          placeholder={
            remaining === 0 ? 'Daily limit reached' : 'Ask about this lesson…'
          }
          className="w-full resize-none rounded border border-slate-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-ink-muted">
            {remaining} of {dailyLimit} messages left today
          </span>
          {busy ? (
            <button
              type="button"
              onClick={() => void stop()}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
            >
              Send
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
