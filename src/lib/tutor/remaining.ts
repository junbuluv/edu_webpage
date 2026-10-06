// Messages left today, as the tutor panel shows it. Pure and alias-free; runs
// in the browser. The server puts its exact count on each finished reply
// (message metadata, see stream.ts). A reply that failed before any text
// carries no count because its quota slot was refunded, so the last finished
// reply's count, or the page's initial count, stays correct.

export interface MessageWithMetadata {
  role: string;
  metadata?: unknown;
}

export function remainingFromMessages(
  messages: readonly MessageWithMetadata[],
  initialRemaining: number,
): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== 'assistant') continue;
    const value = (message.metadata as { remaining?: unknown } | undefined)
      ?.remaining;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, value);
    }
  }
  return initialRemaining;
}
