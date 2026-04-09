/**
 * Dev:
 * - 504 "Outdated Optimize Dep": `npm run dev:reset` (xóa cache + --force), hoặc `npm run dev:force`, hard-refresh (Ctrl+Shift+R).
 * - "Failed to fetch dynamically imported module": thường do tab cũ / server restart — F5 hoặc để App dùng lazyImport tự reload 1 lần.
 * - Project trên OneDrive: nếu watcher lỗi, chạy `set VITE_USE_POLLING=1&& npm run dev` (Windows CMD) hoặc `VITE_USE_POLLING=1 npm run dev` (bash).
 */
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    watch: {
      usePolling: process.env.VITE_USE_POLLING === "1",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    // Không dùng manualChunks tùy ý: tách react/vendor/charts dễ tạo circular chunks
    // và lỗi runtime "Cannot access before initialization" trên bản production.
    // AttendanceList + SeasonalStaff import tĩnh trong App (tránh lỗi fetch lazy trong dev).
    chunkSizeWarningLimit: 3200,
  },
});
