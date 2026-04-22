import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../dist/client"),
    emptyOutDir: true,
  },
});
