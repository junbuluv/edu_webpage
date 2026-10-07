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
    // Merge text parts into one so every length cap below applies to the
    // whole message; capping each part separately let one message carry 50
    // parts of the maximum length.
    const text = m.parts
      .flatMap((p) =>
        p.type === 'text' && typeof p.text === 'string' ? [p.text] : [],
      )
      .join('\n');
    if (text.trim() === '') continue;
    cleaned.push({ id: m.id, role, parts: [{ type: 'text', text }] });
  }

  const recent = cleaned.slice(-TUTOR_HISTORY_LIMIT);
  const last = recent.at(-1);
  if (!last) return { ok: false, reason: 'empty_conversation' };
  if (last.role !== 'user')
    return { ok: false, reason: 'last_message_not_user' };
  if (last.parts[0].text.length > TUTOR_MAX_MESSAGE_CHARS) {
    return { ok: false, reason: 'message_too_long' };
  }

  const messages = recent.map(
    (m, i): TutorMessage =>
      i === recent.length - 1
        ? m
        : {
            ...m,
            parts: [
              {
                type: 'text',
                text: m.parts[0].text.slice(0, TUTOR_MAX_HISTORY_CHARS),
              },
            ],
          },
  );
  return { ok: true, value: { lessonSlug: parsed.data.lessonSlug, messages } };
}
