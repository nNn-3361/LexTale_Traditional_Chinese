/** The item bank for the pilot and analysis pages, and how a run's item list is chosen. */

export type Lexicality = "real" | "pseudo";

export interface Item {
  id: string;
  lexicality: Lexicality;
  /** real, pseudo_legal_position or noncharacter_illegal_position */
  type: string;
  batch: number | null;
  /** Frequency band (real items only), e.g. "1-5" per million. */
  band: string;
  perMillion: number | null;
  char: string;
  /** Source characters of a pseudo-character, e.g. "語+湖". */
  sources: string;
  ids: string;
  strokes: number | null;
  review: string;
  /** Image path relative to the page. */
  image: string;
}

export interface Bank {
  set: string;
  generated: string;
  items: Item[];
}

export async function loadBank(): Promise<Bank> {
  const res = await fetch("items.json");
  if (!res.ok) throw new Error(`items.json: ${res.status}`);
  return res.json();
}

export type SetChoice = "form90" | "all" | "quick";

/**
 * Test length and ratio decided by the team on 2026-11-23: 90 items per test,
 * real:pseudo = 2:1 (60 real, 30 pseudo).
 */
export const FORM_REAL = 60;
export const FORM_PSEUDO = 30;

export const SET_LABELS: Record<SetChoice, string> = {
  form90: "正式長度 90 題（60 真字 / 30 假字）/ Test length: 90 items (60 real / 30 pseudo)",
  all: "全部題目 / All items",
  quick: "快速試用 20 題 / Quick try (20 items)",
};

export interface Plan {
  practice: Item[];
  test: Item[];
}

export function shuffle<T>(a: T[], rand = Math.random): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

const take = (items: Item[], lex: Lexicality, n: number) => shuffle(items.filter((i) => i.lexicality === lex)).slice(0, n);

/**
 * Chooses the test items for a run and the practice items.
 *
 * "form90" draws a new random 60 real + 30 pseudo items from the bank for
 * every run. While the bank is larger than 90 items (pilot stage), this spreads
 * responses over all items, so the team can pick the final fixed items from
 * the pilot data. If the bank has fewer items of a kind, all of them are used.
 *
 * The bank has no separate practice items yet [TBD]. Practice items (2 real,
 * 2 pseudo) are taken from bank items outside the chosen test set when there
 * are enough; otherwise (the full set) they are taken from the set and left out
 * of that run's test, so no item is shown twice and every item still gets data
 * in most runs. Test order is random for every run.
 */
export function planRun(bank: Item[], choice: SetChoice, withPractice: boolean): Plan {
  let pool: Item[];
  if (choice === "quick") pool = [...take(bank, "real", 10), ...take(bank, "pseudo", 10)];
  else if (choice === "form90") pool = [...take(bank, "real", FORM_REAL), ...take(bank, "pseudo", FORM_PSEUDO)];
  else pool = bank.slice();

  let practice: Item[] = [];
  if (withPractice) {
    const outside = bank.filter((i) => !pool.includes(i));
    const from = (lex: Lexicality) =>
      outside.filter((i) => i.lexicality === lex).length >= 2 ? take(outside, lex, 2) : take(pool, lex, 2);
    practice = shuffle([...from("real"), ...from("pseudo")]);
    pool = pool.filter((i) => !practice.includes(i));
  }
  return { practice, test: shuffle(pool) };
}
