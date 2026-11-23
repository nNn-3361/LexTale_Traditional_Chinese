/** The item bank for the beta page, and how a run's item list is chosen. */

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

export type SetChoice = "form" | "all" | "quick";

/**
 * Test length and ratio decided by the team on 2026-11-23: 90 items,
 * real : pseudo = 2 : 1 (60 real characters, 30 pseudo-characters), the same as
 * LEXTALE_CH (Chan & Chang, 2018).
 */
export const FORM = { real: 60, pseudo: 30 } as const;

export const SET_LABELS: Record<SetChoice, string> = {
  form: `測驗版 ${FORM.real + FORM.pseudo} 題（${FORM.real} 真字、${FORM.pseudo} 假字）/ Test form (${FORM.real} real, ${FORM.pseudo} pseudo)`,
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
 * "form" draws FORM.real real and FORM.pseudo pseudo items at random from the
 * bank for each run, so every run has the 2:1 ratio while every bank item
 * still gets pilot data. The items a run used are recorded with its trials.
 * The final test will be one fixed set chosen from the pilot data [TBD]. If the
 * bank has fewer items of a kind than the form needs, all of them are used.
 *
 * The bank has no separate practice items yet [TBD]. Practice items (2 real,
 * 2 pseudo) are taken from bank items outside the chosen test set when there
 * are enough; otherwise (the full set) they are taken from the set and left out
 * of that run's test, so no item is shown twice and every item still gets data
 * in most runs. Test order is random for every run.
 */
export function planRun(bank: Item[], choice: SetChoice, withPractice: boolean): Plan {
  let pool: Item[];
  if (choice === "form") pool = [...take(bank, "real", FORM.real), ...take(bank, "pseudo", FORM.pseudo)];
  else if (choice === "quick") pool = [...take(bank, "real", 10), ...take(bank, "pseudo", 10)];
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
