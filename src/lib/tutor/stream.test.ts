// Run: node --test src/lib/tutor/stream.test.ts
//
// Drives the real streamText -> toTutorUIStream pipeline. Only the model
// provider is mocked (MockLanguageModelV4), so these tests see the same
// chunk sequence the browser does.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streamText } from 'ai';
import {
  MockLanguageModelV4,
  convertArrayToReadableStream,
  convertReadableStreamToArray,
} from 'ai/test';
import type { LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { toTutorUIStream } from './stream.ts';

type Chunk = { type: string; errorText?: string; messageMetadata?: unknown };

const finish: LanguageModelV4StreamPart = {
  type: 'finish',
  usage: {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 4, text: 4, reasoning: 0 },
  },
  finishReason: { unified: 'stop', raw: 'stop' },
};

function text(delta: string): LanguageModelV4StreamPart[] {
  return [
    { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta },
    { type: 'text-end', id: 't' },
  ];
}

function streaming(parts: LanguageModelV4StreamPart[]) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream<LanguageModelV4StreamPart>([
        { type: 'stream-start', warnings: [] },
        ...parts,
      ]),
    }),
  });
}

function failing(error: unknown) {
  return new MockLanguageModelV4({
    doStream: async () => {
      throw error;
    },
  });
}

async function run(model: MockLanguageModelV4, remaining = 39) {
  const result = streamText({
    model,
    prompt: 'hi',
    maxRetries: 0,
    onError: () => {},
  });
  return (await convertReadableStreamToArray(
    toTutorUIStream(result.stream, { remaining }),
  )) as Chunk[];
}

const metadataOf = (chunks: Chunk[], type: string) =>
  chunks.find((c) => c.type === type)?.messageMetadata;

test('puts the server messages-left count on the reply as it starts and finishes', async () => {
  const chunks = await run(streaming([...text('Hi'), finish]));
  assert.deepEqual(metadataOf(chunks, 'start'), { remaining: 39 });
  assert.deepEqual(metadataOf(chunks, 'finish'), { remaining: 39 });
});

test('a failure before any text still shows the count (the attempt counted)', async () => {
  const chunks = await run(failing(new Error('upstream down')));
  assert.deepEqual(metadataOf(chunks, 'start'), { remaining: 39 });
  assert.equal(
    chunks.find((c) => c.type === 'error')?.errorText,
    'unavailable',
  );
});

test('a failure after text keeps the partial reply and the count', async () => {
  const chunks = await run(
    streaming([
      { type: 'text-start', id: 't' },
      { type: 'text-delta', id: 't', delta: 'Partial' },
      { type: 'error', error: new Error('cut off') },
    ]),
  );
  assert.ok(chunks.some((c) => c.type === 'text-delta'));
  assert.ok(chunks.some((c) => c.type === 'error'));
  assert.deepEqual(metadataOf(chunks, 'start'), { remaining: 39 });
});

test('budget rejections reach the browser as budget_exhausted', async () => {
  const chunks = await run(
    failing(Object.assign(new Error('Gateway error'), { statusCode: 402 })),
  );
  assert.equal(
    chunks.find((c) => c.type === 'error')?.errorText,
    'budget_exhausted',
  );
});

test('never sends reasoning to the browser', async () => {
  const chunks = await run(
    streaming([
      { type: 'reasoning-start', id: 'r' },
      { type: 'reasoning-delta', id: 'r', delta: 'The answer is 4.' },
      { type: 'reasoning-end', id: 'r' },
      ...text('What have you tried?'),
      finish,
    ]),
  );
  assert.ok(chunks.every((c) => !c.type.startsWith('reasoning')));
  assert.ok(chunks.some((c) => c.type === 'text-delta'));
});
