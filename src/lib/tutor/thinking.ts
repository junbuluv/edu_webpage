// Whether the tutor panel should show "Thinking…": the request is out, or the
// reply has started streaming but no words have arrived yet (a reasoning
// model can spend several seconds before its first word). Pure and
// alias-free; runs in the browser.

export interface MessageWithParts {
  role: string;
  parts: readonly { type: string; text?: string }[];
}

export function awaitingFirstWords(
  status: string,
  messages: readonly MessageWithParts[],
): boolean {
  if (status === 'submitted') return true;
  if (status !== 'streaming') return false;
  const last = messages.at(-1);
  if (!last || last.role !== 'assistant') return true;
  return !last.parts.some(
    (part) => part.type === 'text' && (part.text ?? '').trim() !== '',
  );
}
