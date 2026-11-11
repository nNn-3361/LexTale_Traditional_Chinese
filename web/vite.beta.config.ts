import { defineConfig } from "vite";

// Static build of the beta page (beta.html). It needs no server: the item
// bank (items.json + images) comes from .beta-bank/, made by
// `npm run beta:prepare`, and is copied into the output as is.
export default defineConfig({
  base: "./",
  publicDir: ".beta-bank",
  build: {
    outDir: "dist-beta",
    emptyOutDir: true,
    rollupOptions: { input: "beta.html" },
  },
  server: { open: "/beta.html" },
});
