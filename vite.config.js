/**
 * Dev:
 * - 504 "Outdated Optimize Dep": `npm run dev:reset` (xóa cache + --force), hoặc `npm run dev:force`, hard-refresh (Ctrl+Shift+R).
 * - "Failed to fetch dynamically imported module": thường do tab cũ / server restart — F5 hoặc để App dùng lazyImport tự reload 1 lần.
 * - Project trên OneDrive: nếu watcher lỗi, chạy `set VITE_USE_POLLING=1&& npm run dev` (Windows CMD) hoặc `VITE_USE_POLLING=1 npm run dev` (bash).
 * - Upload ảnh ImgBB: API key trong `.env` (IMGBB_API_KEY) — proxy `/api/imgbb/upload` qua Vite dev server.
 */
import path from "path";
import { fileURLToPath } from "url";
/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createImgbbUploadMiddleware } from "./server/imgbbUploadHandler.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (env.IMGBB_API_KEY) process.env.IMGBB_API_KEY = env.IMGBB_API_KEY;
  if (env.IMGBB_UPLOAD_URL) process.env.IMGBB_UPLOAD_URL = env.IMGBB_UPLOAD_URL;

  const imgbbMiddleware = createImgbbUploadMiddleware();

  return {
    plugins: [
      react(),
      {
        name: "imgbb-upload-proxy",
        configureServer(server) {
          server.middlewares.use(imgbbMiddleware);
        },
        configurePreviewServer(server) {
          server.middlewares.use(imgbbMiddleware);
        },
      },
    ],
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
    test: {
      environment: "node",
      include: ["src/**/*.test.js"],
    },
  };
});
