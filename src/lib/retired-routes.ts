// ECO 1002 (Introduction to Macroeconomics) was removed from the site on
// 2026-11-25. Its old lesson, quiz and workshop addresses send visitors to the
// home page, which says the course is gone. Only addresses that match a page
// are listed: on Vercel a middleware redirect from an address with no page
// arrives as a blank 404, so `/eco-1002/…` and `/macro` get the 404 page.
// Alias-free so `node --test` can import it.

/** Where every old ECO 1002 address goes; the home page reads `from`. */
export const RETIRED_COURSE_TARGET = '/?from=eco-1002';

const RETIRED =
  /^\/lessons\/eco-1002(?:\/|$)|^\/(?:practice|workshops)\/eco-1002-/;

/** The redirect target for an old ECO 1002 path, or null for any other. */
export function retiredCourseRedirect(pathname: string): string | null {
  return RETIRED.test(pathname) ? RETIRED_COURSE_TARGET : null;
}
