// WCAG 2.x contrast math and a reader for the theme tokens declared in
// src/styles/global.css. Alias-free so `node --test` can import it.

export type Rgb = [number, number, number];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const CHANNELS = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/;

/** Parses '#rgb', '#rrggbb', or an 'r g b' channel triplet (as stored in :root). */
export function toRgb(value: string): Rgb {
  const v = value.trim();
  const hex = HEX.exec(v);
  if (hex) {
    const full =
      hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
  }
  const channels = CHANNELS.exec(v);
  if (channels) {
    const rgb = channels.slice(1).map(Number) as Rgb;
    if (rgb.every((c) => c <= 255)) return rgb;
  }
  throw new Error(`Not a color token value: "${value}"`);
}

export function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [
    relativeLuminance(toRgb(a)),
    relativeLuminance(toRgb(b)),
  ].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Collects `--name: value;` declarations from every `:root { … }` block. */
export function parseRootTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const uncommented = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const block of uncommented.matchAll(/:root\s*\{([^}]*)\}/g)) {
    for (const decl of block[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      tokens[decl[1]] = decl[2].trim();
    }
  }
  return tokens;
}
