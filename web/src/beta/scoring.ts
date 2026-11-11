/**
 * Scores for the beta page. These are computed in the browser only for the
 * beta; in the full system scores are computed on the server
 * (server/app/scoring.py). Which score the final test uses is decided from the
 * pilot data [TBD] (research proposal, section 5.6).
 */

export interface ScoredTrial {
  lexicality: "real" | "pseudo";
  response: "yes" | "no";
  rt: number;
}

export interface RunScore {
  realN: number;
  pseudoN: number;
  /** Real items answered "yes". */
  hits: number;
  /** Pseudo items answered "no". */
  correctRejections: number;
  /** Pseudo items answered "yes". */
  falseAlarms: number;
  realPct: number;
  pseudoPct: number;
  /** LexTALE averaged score: mean of realPct and pseudoPct. Same as the server's lextale_avg. */
  avgPct: number;
  /** hits - (realN / pseudoN) * falseAlarms. */
  ghent: number;
  /** ghent as a percentage of realN. */
  ghentPct: number;
  dPrime: number;
  /** Mean RT of correct answers, in ms; null if none. */
  meanRtCorrect: number | null;
}

/**
 * Inverse of the standard normal CDF (Acklam's rational approximation,
 * relative error below 1.2e-9). p must be in (0, 1).
 */
export function normInv(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lo) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export function scoreRun(trials: ScoredTrial[]): RunScore {
  const real = trials.filter((t) => t.lexicality === "real");
  const pseudo = trials.filter((t) => t.lexicality === "pseudo");
  const hits = real.filter((t) => t.response === "yes").length;
  const correctRejections = pseudo.filter((t) => t.response === "no").length;
  const falseAlarms = pseudo.length - correctRejections;
  const pct = (k: number, n: number) => (n ? (100 * k) / n : 0);
  const realPct = pct(hits, real.length);
  const pseudoPct = pct(correctRejections, pseudo.length);
  const ratio = pseudo.length ? real.length / pseudo.length : 0;
  const ghent = hits - ratio * falseAlarms;
  // Log-linear correction (add 0.5 to counts, 1 to totals) keeps rates off 0 and 1.
  const hitRate = (hits + 0.5) / (real.length + 1);
  const faRate = (falseAlarms + 0.5) / (pseudo.length + 1);
  const correct = trials.filter((t) => (t.lexicality === "real") === (t.response === "yes"));
  return {
    realN: real.length,
    pseudoN: pseudo.length,
    hits,
    correctRejections,
    falseAlarms,
    realPct,
    pseudoPct,
    avgPct: (realPct + pseudoPct) / 2,
    ghent,
    ghentPct: pct(ghent, real.length),
    dPrime: normInv(hitRate) - normInv(faRate),
    meanRtCorrect: correct.length ? correct.reduce((s, t) => s + t.rt, 0) / correct.length : null,
  };
}

/** Pearson correlation; with one 0/1 variable this is the point-biserial correlation. Null if undefined. */
export function correlation(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 3) return null;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
