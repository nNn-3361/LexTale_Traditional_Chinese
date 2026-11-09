/** Calls to the backend (server/app/routers/runs.py). */

export type Mode = "research" | "formal";

export interface SessionInfo {
  code: string;
  label: string | null;
  mode: Mode;
  consent_version: string;
  n_practice: number;
  n_test: number;
}

export interface Trial {
  position: number;
  role: "practice" | "test";
  image_url: string;
  correct_response: "yes" | "no" | null;
}

export interface Run {
  run_id: string;
  mode: Mode;
  trials: Trial[];
}

export interface ResponseBody {
  position: number;
  response: "yes" | "no";
  rt_ms: number;
  source: "key" | "button";
  presented_at: string;
}

export interface FinishResult {
  answered: number;
  planned: number;
  scores: { method: string; formula_version: number; value: number }[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, String(detail));
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const getSession = (code: string) =>
  call<SessionInfo>("GET", `/api/sessions/${encodeURIComponent(code)}`);

export const startRun = (body: {
  session_code: string;
  consent: boolean;
  consent_version: string;
  identity?: { external_code?: string };
}) => call<Run>("POST", "/api/runs", body);

export const finishRun = (runId: string) => call<FinishResult>("POST", `/api/runs/${runId}/finish`);

/**
 * Sends each response as soon as it is given, in the background, so a lost
 * connection late in the test does not lose earlier answers. Failed sends are
 * retried; `flush()` waits for all of them before the run is finished.
 */
export class ResponseQueue {
  private pending: Promise<void>[] = [];
  private failed: ResponseBody[] = [];

  constructor(private runId: string) {}

  send(body: ResponseBody) {
    this.pending.push(this.trySend(body));
  }

  private async trySend(body: ResponseBody, attempts = 4) {
    for (let i = 0; i < attempts; i++) {
      try {
        await call<void>("POST", `/api/runs/${this.runId}/responses`, body);
        return;
      } catch (e) {
        // 4xx other than 408/429 will not get better by retrying.
        if (e instanceof ApiError && e.status < 500 && e.status !== 408 && e.status !== 429) break;
        await sleep(500 * 2 ** i);
      }
    }
    this.failed.push(body);
  }

  /** Waits for all sends; resends failed ones once more. Returns the number still failing. */
  async flush(): Promise<number> {
    await Promise.all(this.pending);
    const retry = this.failed.splice(0);
    this.pending = retry.map((b) => this.trySend(b));
    await Promise.all(this.pending);
    return this.failed.length;
  }
}
