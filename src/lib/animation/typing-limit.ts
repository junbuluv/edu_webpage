// WCAG 2.2.2 (Pause, Stop, Hide): content that moves or updates on its own
// must stop within 5 seconds unless the user can pause it. The home-page
// typing headline has no pause control, so it must settle in time.
export const TYPING_RUN_LIMIT_MS = 5000;
// Browser timers fire a few ms late on every character (about 0.25 s over a
// run), so plan to finish with half a second in hand.
export const TIMER_SLACK_MS = 500;

export interface TypingTiming {
  typeMs: number;
  deleteMs: number;
  holdMs: number;
}

/**
 * Whether one more word swap (hold the current word, delete it, type the
 * next one) would finish within the run limit. `elapsedMs` is measured from
 * when the animation started.
 */
export function canSwapAgain(
  elapsedMs: number,
  currentLength: number,
  nextLength: number,
  { typeMs, deleteMs, holdMs }: TypingTiming,
  limitMs = TYPING_RUN_LIMIT_MS - TIMER_SLACK_MS,
): boolean {
  const swapMs = holdMs + currentLength * deleteMs + nextLength * typeMs;
  return elapsedMs + swapMs <= limitMs;
}
