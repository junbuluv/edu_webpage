export interface ParsedCookie {
  name: string;
  value: string;
}

const COOKIE_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export function parseCookieHeader(header: string): ParsedCookie[] {
  const parsed: ParsedCookie[] = [];
  for (const segment of header.split(';')) {
    const pair = segment.trim();
    if (!pair) continue;

    const equals = pair.indexOf('=');
    if (equals <= 0) continue;
    const name = pair.slice(0, equals).trim();
    if (!COOKIE_NAME.test(name)) continue;

    try {
      parsed.push({
        name,
        value: decodeURIComponent(pair.slice(equals + 1)),
      });
    } catch {
      // One malformed or unrelated cookie must not prevent authentication or
      // public pages from loading. Supabase treats an omitted auth cookie as
      // signed out and can issue a fresh value on the next successful login.
    }
  }
  return parsed;
}
