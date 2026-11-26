// ECO 1002 (Introduction to Macroeconomics) was removed from the site on
// 2026-11-25. Its old public addresses send visitors to the home page, which
// says the course is gone. Alias-free so `node --test` can import it.

/** Where every old ECO 1002 address goes; the home page reads `from`. */
export const RETIRED_COURSE_TARGET = '/?from=eco-1002';

const RETIRED =
  /^\/(?:eco-1002|macro|lessons\/eco-1002)(?:\/|$)|^\/(?:practice|workshops)\/eco-1002-/;

/** The redirect target for an old ECO 1002 path, or null for any other. */
export function retiredCourseRedirect(pathname: string): string | null {
  return RETIRED.test(pathname) ? RETIRED_COURSE_TARGET : null;
}
