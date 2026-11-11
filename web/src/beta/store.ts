/**
 * Where the beta page keeps finished runs.
 *
 * - This browser (localStorage): always used.
 * - A shared store: only when the page runs as a claude.ai Artifact with the
 *   `db` capability (window.claude). Then every tester's runs are pooled, so
 *   the item analysis covers everyone who took the test there. Outside an
 *   Artifact, window.claude does not exist and only this browser is used.
 *
 * Runs hold no names or other personal data: an optional group label, the
 * item set, and per item the response, RT and input method.
 */
import type { SetChoice } from "./bank";

export interface TrialRecord {
  /** Item id */
  i: string;
  r: "yes" | "no";
  /** RT in ms */
  rt: number;
  /** key or button */
  s: "key" | "button";
}

export interface RunRecord {
  id: string;
  createdAt: string;
  /** Optional group label, e.g. "native" or "learner". Never a name. */
  label: string;
  set: SetChoice | "import";
  bankSet: string;
  practice: string[];
  /** Test trials in the order shown. */
  trials: TrialRecord[];
}

const LOCAL_KEY = "lextale-beta-runs-v1";
const COLLECTION = "beta-runs";

function readLocal(): RunRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocal(runs: RunRecord[]): boolean {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(runs));
    return true;
  } catch {
    return false;
  }
}

// Minimal shape of the Artifact db capability used here.
interface DocSnap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface SharedDb {
  collection(path: string): {
    doc(id: string): { set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> };
    limit(n: number): { get(): Promise<{ docs: DocSnap[] }> };
  };
}

let sharedPromise: Promise<SharedDb | null> | null = null;

/** The shared store, or null outside an Artifact (or when the viewer cannot use it). */
export function shared(): Promise<SharedDb | null> {
  if (!sharedPromise) {
    const claude = (window as unknown as { claude?: { use?(n: string): Promise<unknown> } }).claude;
    sharedPromise = claude?.use
      ? (claude.use("db") as Promise<SharedDb | null>).catch(() => null)
      : Promise.resolve(null);
  }
  return sharedPromise;
}

export interface SaveResult {
  local: boolean;
  /** null: no shared store on this page. */
  shared: boolean | null;
}

export async function saveRun(run: RunRecord): Promise<SaveResult> {
  const runs = readLocal().filter((r) => r.id !== run.id);
  runs.push(run);
  const local = writeLocal(runs);
  const db = await shared();
  if (!db) return { local, shared: null };
  try {
    await db.collection(COLLECTION).doc(run.id).set({ ...run });
    return { local, shared: true };
  } catch (e) {
    console.error(e);
    return { local, shared: false };
  }
}

export interface LoadResult {
  runs: RunRecord[];
  localCount: number;
  /** null: no shared store; -1: the shared store could not be read. */
  sharedCount: number | null;
}

/** All runs from this browser and the shared store, without duplicates, oldest first. */
export async function loadRuns(): Promise<LoadResult> {
  const byId = new Map<string, RunRecord>();
  const local = readLocal();
  for (const r of local) byId.set(r.id, r);
  let sharedCount: number | null = null;
  const db = await shared();
  if (db) {
    try {
      const snap = await db.collection(COLLECTION).limit(1000).get();
      sharedCount = 0;
      for (const d of snap.docs) {
        const r = d.data() as unknown as RunRecord | undefined;
        if (d.exists && r && Array.isArray(r.trials)) {
          byId.set(r.id, r);
          sharedCount++;
        }
      }
    } catch (e) {
      console.error(e);
      sharedCount = -1;
    }
  }
  const runs = [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { runs, localCount: local.length, sharedCount };
}

/** Adds imported runs to this browser's store. Returns how many were new. */
export function importRuns(runs: RunRecord[]): number {
  const existing = readLocal();
  const ids = new Set(existing.map((r) => r.id));
  const fresh = runs.filter((r) => !ids.has(r.id));
  writeLocal([...existing, ...fresh]);
  return fresh.length;
}

/** Removes the runs kept in this browser. The shared store is not touched. */
export function clearLocal() {
  writeLocal([]);
}

export function newRunId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Offers a text file to the viewer: the Artifact downloads capability if present, else a normal download link. */
export async function saveFile(filename: string, text: string, type = "text/csv"): Promise<void> {
  const claude = (window as unknown as { claude?: { use?(n: string): Promise<unknown> } }).claude;
  if (claude?.use) {
    const dl = (await claude.use("downloads").catch(() => null)) as {
      save(o: { filename: string; data: Blob }): Promise<unknown>;
    } | null;
    if (dl) {
      await dl.save({ filename, data: new Blob([text], { type }) });
      return;
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
