// Prepares a tutor reply for react-markdown + remark-math (convention #22's
// trap, in chat form). The coach rules tell the model to write math as
// \( \) / \[ \] and money as $5, but remark-math reads any $…$ pair as math.
// So: leave code alone, turn \( \), \[ \] and existing $$…$$ into math, then
// escape every remaining $ as money. Pure and alias-free; runs in the browser.

const CODE = /```[\s\S]*?```|`[^`\n]*`/g;
const MATH = /\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$\$([\s\S]+?)\$\$/g;
const HOLD = /\u0000(\d+)\u0000/g;
// remark-math ignores backslash escapes inside $…$ (convention #22), so a
// dollar sign inside inline math ("\(FV = \$100\)") would end the span early.
// KaTeX draws \text{\textdollar} as the same symbol. Display math needs no
// rewrite: a lone $ cannot close a $$ block.
const INLINE_MATH_DOLLAR = /\\?\$/g;

function escapeDollars(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    out += s[i] === '$' && s[i - 1] !== '\\' ? '\\$' : s[i];
  }
  return out;
}

function normalizeProse(text: string): string {
  const math: string[] = [];
  const held = text.replace(
    MATH,
    (_m, display?: string, inline?: string, dollars?: string) => {
      if (display !== undefined) math.push(`\n$$\n${display.trim()}\n$$\n`);
      else if (inline !== undefined) {
        const body = inline
          .trim()
          .replace(INLINE_MATH_DOLLAR, () => '\\text{\\textdollar}');
        math.push(`$${body}$`);
      } else math.push(`$$${dollars ?? ''}$$`);
      return `\u0000${math.length - 1}\u0000`;
    },
  );
  // Function replacers on purpose: a string replacement would treat "$$" as
  // an escape and collapse it to "$".
  return escapeDollars(held).replace(HOLD, (_m, i: string) => math[Number(i)]);
}

export function normalizeMathDelimiters(text: string): string {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(CODE)) {
    const start = m.index ?? 0;
    out += normalizeProse(text.slice(last, start)) + m[0];
    last = start + m[0].length;
  }
  return out + normalizeProse(text.slice(last));
}
