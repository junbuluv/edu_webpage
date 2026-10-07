// Per-provider request options for the tutor model. Pure and alias-free; the
// route and scripts/tutor-eval.ts share it, so the eval measures exactly what
// production sends. Only OpenAI models take reasoningEffort; other providers
// run with their defaults.

export type TutorEffort = 'none' | 'low' | 'medium' | 'high';
const EFFORTS: readonly string[] = ['none', 'low', 'medium', 'high'];

export function parseTutorEffort(value: string | undefined): TutorEffort {
  return value !== undefined && EFFORTS.includes(value)
    ? (value as TutorEffort)
    : 'low';
}

export function providerOptionsFor(
  modelId: string,
  effort: TutorEffort,
): Record<string, Record<string, string>> {
  if (modelId.startsWith('openai/'))
    return { openai: { reasoningEffort: effort } };
  return {};
}
