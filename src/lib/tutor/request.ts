// Parses and sanitizes the tutor chat POST body. Pure and alias-free so it
// runs under node --test. The browser controls this payload, so anything the
// model must not see (system-role messages, files, oversized history) is
// dropped here instead of trusted.
import { z } from 'zod';
import {
  TUTOR_HISTORY_LIMIT,
  TUTOR_MAX_HISTORY_CHARS,
  TUTOR_MAX_MESSAGE_CHARS,
} from './limits.ts';

export interface TutorTextPart {
  type: 'text';
  text: string;
}
export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: TutorTextPart[];
}
export interface TutorRequest {
  lessonSlug: string;
  messages: TutorMessage[];
}
export type TutorRequestError =
  | 'invalid_body'
  | 'empty_conversation'
  | 'last_message_not_user'
  | 'message_too_long';
export type TutorParseResult =
  | { ok: true; value: TutorRequest }
  | { ok: false; reason: TutorRequestError };

const BodySchema = z.object({
  lessonSlug: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/),
  messages: z
    .array(
      z.object({
        id: z.string().max(200),
        role: z.string(),
        parts: z
          .array(
            z
              .object({ type: z.string(), text: z.unknown().optional() })
              .passthrough(),
          )
          .max(50),
      }),
    )
    .min(1)
    .max(100),
});

export function parseTutorRequest(raw: unknown): TutorParseResult {
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'invalid_body' };

  const cleaned: TutorMessage[] = [];
  for (const m of parsed.data.messages) {
    const role =
      m.role === 'user' ? 'user' : m.role === 'assistant' ? 'assistant' : null;
    if (!role) continue;
    const parts: TutorTextPart[] = [];
    for (const p of m.parts) {
      if (
        p.type === 'text' &&
        typeof p.text === 'string' &&
        p.text.trim() !== ''
      ) {
        parts.push({ type: 'text', text: p.text });
      }
    }
    if (parts.length > 0) cleaned.push({ id: m.id, role, parts });
  }

  const recent = cleaned.slice(-TUTOR_HISTORY_LIMIT);
  const last = recent.at(-1);
  if (!last) return { ok: false, reason: 'empty_conversation' };
  if (last.role !== 'user')
    return { ok: false, reason: 'last_message_not_user' };
  const lastLength = last.parts.reduce((n, p) => n + p.text.length, 0);
  if (lastLength > TUTOR_MAX_MESSAGE_CHARS) {
    return { ok: false, reason: 'message_too_long' };
  }

  const messages = recent.map((m, i) =>
    i === recent.length - 1
      ? m
      : {
          ...m,
          parts: m.parts.map((p) => ({
            type: 'text' as const,
            text: p.text.slice(0, TUTOR_MAX_HISTORY_CHARS),
          })),
        },
  );
  return { ok: true, value: { lessonSlug: parsed.data.lessonSlug, messages } };
}
