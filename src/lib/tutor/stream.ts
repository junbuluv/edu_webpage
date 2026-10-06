// Turns streamText's part stream into the UI message stream the tutor panel
// reads. Alias-free (package imports only) so node --test can drive it with a
// mock model. It:
// - puts the server's messages-left count on the finished reply (message
//   metadata), so the panel's counter matches the daily cap;
// - calls onNoOutputFailure once when the provider fails before any text, so
//   the route can refund the reserved quota slot. The student got nothing. A
//   reply that fails midway keeps its slot, so retrying can't dodge the cap;
// - never sends reasoning to the browser: it can contain the answer the
//   coach is holding back.
import { toUIMessageStream, type TextStreamPart, type ToolSet } from 'ai';
import { classifyStreamError } from './errors.ts';

export interface TutorMessageMetadata {
  remaining: number;
}

export interface TutorUIStreamOptions {
  remaining: number;
  onNoOutputFailure: () => void | Promise<void>;
}

export function toTutorUIStream(
  stream: ReadableStream<TextStreamPart<ToolSet>>,
  { remaining, onNoOutputFailure }: TutorUIStreamOptions,
) {
  let producedText = false;
  let refunded = false;
  const watched = stream.pipeThrough(
    new TransformStream<TextStreamPart<ToolSet>, TextStreamPart<ToolSet>>({
      async transform(part, controller) {
        if (part.type === 'text-delta' && part.text !== '') producedText = true;
        if (part.type === 'error' && !producedText && !refunded) {
          refunded = true;
          try {
            await onNoOutputFailure();
          } catch {
            // The caller logs its own failure. A failed refund must not keep
            // the error message from reaching the student.
          }
        }
        controller.enqueue(part);
      },
    }),
  );
  return toUIMessageStream({
    stream: watched,
    sendReasoning: false,
    messageMetadata: ({ part }): TutorMessageMetadata | undefined =>
      part.type === 'finish' ? { remaining } : undefined,
    onError: (error) => classifyStreamError(error),
  });
}
