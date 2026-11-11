import { defineConfig } from "vite";

// Static build of the participant pilot page (pilot.html), written as
// dist-pilot/index.html. Results go to the URL in VITE_RESULTS_URL
// (see docs/pilot-hosting.md). The item bank comes from .beta-bank/, made by
// `npm run beta:prepare`.
export default defineConfig({
  base: "./",
  publicDir: ".beta-bank",
  build: {
    outDir: "dist-pilot",
    emptyOutDir: true,
    rollupOptions: { input: "pilot.html" },
  },
  server: { open: "/pilot.html" },
});
