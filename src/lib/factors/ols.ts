// Ordinary least squares for the factor-regression lesson: y on a constant
// plus the given regressors. Pure and alias-free so `node --test` can run it.
// Standard errors are the classical ones (errors assumed to have constant
// variance and no correlation across months), which is what a first
// regression course and most textbook factor tables report.

export interface OlsResult {
  /** Intercept first, then one slope per regressor, in the order given. */
  coef: number[];
  /** Standard error of each coefficient. */
  se: number[];
  /** t-statistic of each coefficient: coef / se. */
  t: number[];
  /** Share of the variance of y the regression explains. */
  r2: number;
  /** Number of observations. */
  n: number;
}

// Inverse of a small matrix by Gauss-Jordan elimination with partial
// pivoting. Throws when the matrix is singular, which here means one
// regressor is an exact combination of the others (or is constant).
function invert(a: number[][]): number[][] {
  const k = a.length;
  const m = a.map((row, i) => [
    ...row,
    ...Array.from({ length: k }, (_, j) => (i === j ? 1 : 0)),
  ]);
  for (let col = 0; col < k; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < k; r += 1) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    // Relative to the column's own scale, so the check works for returns in
    // percent as well as in decimals.
    if (Math.abs(m[pivot][col]) <= 1e-10 * Math.abs(a[col][col])) {
      throw new Error('ols: regressors are perfectly collinear');
    }
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const p = m[col][col];
    for (let j = 0; j < 2 * k; j += 1) m[col][j] /= p;
    for (let r = 0; r < k; r += 1) {
      const f = m[r][col];
      if (r === col || f === 0) continue;
      for (let j = 0; j < 2 * k; j += 1) m[r][j] -= f * m[col][j];
    }
  }
  return m.map((row) => row.slice(k));
}

const dot = (a: number[], b: number[]) =>
  a.reduce((s, v, i) => s + v * b[i], 0);

/**
 * Regress `y` on a constant and `regressors` (one array per regressor, each
 * the same length as `y`): coef = (X'X)^-1 X'y, with classical standard
 * errors sqrt(s2 * diag((X'X)^-1)) and s2 = SSR / (n - k).
 */
export function ols(y: number[], regressors: number[][]): OlsResult {
  const n = y.length;
  const k = regressors.length + 1;
  if (regressors.some((x) => x.length !== n)) {
    throw new Error('ols: every regressor needs one value per observation');
  }
  if (n <= k) {
    throw new Error('ols: need more observations than coefficients');
  }

  const cols = [new Array<number>(n).fill(1), ...regressors];
  const inv = invert(cols.map((a) => cols.map((b) => dot(a, b))));
  const xty = cols.map((a) => dot(a, y));
  const coef = inv.map((row) => dot(row, xty));

  const yBar = xty[0] / n;
  let ssr = 0;
  let sst = 0;
  for (let i = 0; i < n; i += 1) {
    const fit = coef.reduce((s, c, j) => s + c * cols[j][i], 0);
    ssr += (y[i] - fit) ** 2;
    sst += (y[i] - yBar) ** 2;
  }
  const s2 = ssr / (n - k);
  const se = inv.map((row, j) => Math.sqrt(s2 * row[j]));

  return {
    coef,
    se,
    t: coef.map((c, j) => c / se[j]),
    r2: sst === 0 ? 0 : 1 - ssr / sst,
    n,
  };
}
