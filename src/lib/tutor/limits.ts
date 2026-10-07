// Lesson tutor limits (2026-10-05 design). Alias-free: shared by pure
// modules under node --test, the server route, and the browser island.
export const TUTOR_DAILY_LIMIT = 40; // messages per student, rolling 24 hours
export const TUTOR_HISTORY_LIMIT = 10; // most recent messages sent to the model
export const TUTOR_MAX_MESSAGE_CHARS = 2000; // newest student message
export const TUTOR_MAX_HISTORY_CHARS = 4000; // each older message, truncated
// OpenAI reasoning models count reasoning tokens against this cap, so it
// leaves room above the ~150-word replies the coach rules ask for.
export const TUTOR_MAX_OUTPUT_TOKENS = 1500;
