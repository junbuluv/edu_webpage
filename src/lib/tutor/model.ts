// Server-only: the lesson tutor's AI Gateway model. Reads env through
// import.meta.env like src/lib/supabase/admin.ts. With AI_GATEWAY_API_KEY
// unset the tutor is off (panel hidden, route 503), never a thrown error
// (convention #5). Never import from src/components.
import { createGateway } from 'ai';
import { parseTutorEffort, providerOptionsFor } from './provider-options';

export const DEFAULT_TUTOR_MODEL = 'openai/gpt-6-luna';

export function tutorConfigured(): boolean {
  return Boolean(import.meta.env.AI_GATEWAY_API_KEY);
}

export function tutorModelId(): string {
  return import.meta.env.TUTOR_MODEL || DEFAULT_TUTOR_MODEL;
}

export function tutorProviderOptions() {
  return providerOptionsFor(
    tutorModelId(),
    parseTutorEffort(import.meta.env.TUTOR_REASONING_EFFORT),
  );
}

export function getTutorModel() {
  const apiKey = import.meta.env.AI_GATEWAY_API_KEY;
  if (!apiKey) return null;
  return createGateway({ apiKey })(tutorModelId());
}
