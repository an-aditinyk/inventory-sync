import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy API calls to the FastAPI backend during dev so the frontend can call
// relative paths like /auth/login without CORS headaches.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/auth": "http://localhost:8000",
      "/runs": "http://localhost:8000",
      "/connections": "http://localhost:8000",
      "/settings": "http://localhost:8000",
      "/health": "http://localhost:8000",
    },
  },
});
