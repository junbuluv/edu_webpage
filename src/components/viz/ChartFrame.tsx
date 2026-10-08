import type { ReactNode } from 'react';

interface Props {
  /** What the chart plots: axes, curves, markers. Read in place of the SVG. */
  description: string;
  /** The current values in words; announced politely whenever it changes. */
  summary: string;
  /** The sized chart container (the element the ResponsiveContainer fills). */
  children: ReactNode;
}

/**
 * Text alternative for an interactive chart (WCAG 1.1.1). Screen readers get
 * one labeled graphic instead of the SVG's tick labels, and hear the summary
 * when a slider or preset changes it. Sighted users see no difference.
 */
export default function ChartFrame({ description, summary, children }: Props) {
  return (
    <>
      <div role="img" aria-label={description}>
        {children}
      </div>
      <p className="sr-only" aria-live="polite">
        {summary}
      </p>
    </>
  );
}
