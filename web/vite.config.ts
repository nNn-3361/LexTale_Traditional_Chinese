import { defineConfig } from "vite";

// In development, the backend runs on port 8000 (uvicorn) and Vite forwards
// API and image requests to it.
export default defineConfig({
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/media": "http://127.0.0.1:8000",
    },
  },
});
