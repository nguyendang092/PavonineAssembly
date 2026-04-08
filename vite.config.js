import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    // Không dùng manualChunks tùy ý: tách react/vendor/charts dễ tạo circular chunks
    // và lỗi runtime "Cannot access before initialization" trên bản production.
    chunkSizeWarningLimit: 1200,
  },
});
