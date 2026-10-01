// Resolves a chart series color. Lessons may pass a slot name ('chart-1' to
// 'chart-4'), which follows the site theme, or a literal hex color. Anything
// else falls back to the default slot for the series' position, so a typo
// never renders a black or invisible series. Alias-free for node --test.

const SLOTS = 4;
const SLOT = /^chart-([1-4])$/;
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function defaultSeriesColor(index: number): string {
  const slot = (((index % SLOTS) + SLOTS) % SLOTS) + 1;
  return `var(--chart-${slot})`;
}

export function resolveSeriesColor(
  color: string | undefined,
  index: number,
): string {
  const value = color?.trim();
  if (value) {
    const slot = SLOT.exec(value);
    if (slot) return `var(--chart-${slot[1]})`;
    if (HEX.test(value)) return value;
  }
  return defaultSeriesColor(index);
}
