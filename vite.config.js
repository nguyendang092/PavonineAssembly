/**
 * Dev:
 * - 504 "Outdated Optimize Dep": `npm run dev:reset` (xóa cache + --force), hoặc `npm run dev:force`, hard-refresh (Ctrl+Shift+R).
 * - "Failed to fetch dynamically imported module": thường do tab cũ / server restart — F5 hoặc để App dùng lazyImport tự reload 1 lần.
 * - Project trên OneDrive: nếu watcher lỗi, chạy `set VITE_USE_POLLING=1&& npm run dev` (Windows CMD) hoặc `VITE_USE_POLLING=1 npm run dev` (bash).
 * - Upload ảnh: API `/api/images/upload` (Vite dev / `npm run server`) + Firebase Storage fallback.
 *   `.env`: IMGBB_API_KEY, FIREBASE_API_KEY (xác thực token), IMAGE_UPLOAD_SKIP_AUTH=1 (dev).
 */
import path from "path";
import { fileURLToPath } from "url";
/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createImageUploadMiddleware } from "./server/imageUpload/createImageUploadMiddleware.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (env.IMGBB_API_KEY) process.env.IMGBB_API_KEY = env.IMGBB_API_KEY;
  if (env.IMGBB_UPLOAD_URL) process.env.IMGBB_UPLOAD_URL = env.IMGBB_UPLOAD_URL;
  if (env.FIREBASE_API_KEY) process.env.FIREBASE_API_KEY = env.FIREBASE_API_KEY;
  if (env.IMAGE_UPLOAD_SKIP_AUTH) {
    process.env.IMAGE_UPLOAD_SKIP_AUTH = env.IMAGE_UPLOAD_SKIP_AUTH;
  }

  const imageUploadMiddleware = createImageUploadMiddleware();

  return {
    plugins: [
      react(),
      {
        name: "image-upload-api",
        configureServer(server) {
          server.middlewares.use(imageUploadMiddleware);
        },
        configurePreviewServer(server) {
          server.middlewares.use(imageUploadMiddleware);
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
      include: ["src/**/*.test.js", "server/**/*.test.mjs"],
    },
  };
});
