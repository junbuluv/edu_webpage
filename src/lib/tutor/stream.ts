// Turns streamText's part stream into the UI message stream the tutor panel
// reads. Alias-free (package imports only) so node --test can drive it with a
// mock model. It:
// - puts the server's messages-left count on the reply as it starts and as it
//   finishes (message metadata), so the panel's counter always matches the
//   daily cap. Every attempt counts, including one that fails before any
//   text: refunding failed attempts let a client turn deliberate failures
//   (an abort, a rejected prompt) into unlimited provider calls;
// - never sends reasoning to the browser: it can contain the answer the
//   coach is holding back.
import { toUIMessageStream, type TextStreamPart, type ToolSet } from 'ai';
import { classifyStreamError } from './errors.ts';

export interface TutorMessageMetadata {
  remaining: number;
}

export interface TutorUIStreamOptions {
  /** Messages left after this attempt, as consume_tutor_quota returned it. */
  remaining: number;
}

export function toTutorUIStream(
  stream: ReadableStream<TextStreamPart<ToolSet>>,
  { remaining }: TutorUIStreamOptions,
) {
  return toUIMessageStream({
    stream,
    sendReasoning: false,
    messageMetadata: ({ part }): TutorMessageMetadata | undefined =>
      part.type === 'start' || part.type === 'finish'
        ? { remaining }
        : undefined,
    onError: (error) => classifyStreamError(error),
  });
}
