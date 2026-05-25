import type { ReactNode } from 'react';

interface Props {
  left: ReactNode;
  right: ReactNode;
  leftLabel?: string;
  rightLabel?: string;
  /** Optional caption shown beneath both panels. */
  caption?: string;
}

/**
 * Side-by-side container for two visualizations. On mobile, stacks
 * vertically with the divider becoming a horizontal rule.
 */
export default function CompareScenarios({
  left,
  right,
  leftLabel = 'Baseline',
  rightLabel = 'Your scenario',
  caption,
}: Props) {
  return (
    <section className="my-6 rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-4 md:divide-x md:divide-slate-200">
        <div className="md:pr-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {leftLabel}
          </p>
          {left}
        </div>
        <div className="md:pl-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {rightLabel}
          </p>
          {right}
        </div>
      </div>
      {caption && (
        <p className="mt-4 text-sm text-ink-muted">{caption}</p>
      )}
    </section>
  );
}
