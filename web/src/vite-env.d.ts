/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Pilot page: Apps Script web app URL that receives results. */
  readonly VITE_RESULTS_URL?: string;
  /** Pilot page: item set, "all" (default) or "batch1". */
  readonly VITE_PILOT_SET?: string;
}
