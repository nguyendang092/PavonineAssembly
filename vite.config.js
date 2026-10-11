/**
 * Dev:
 * - 504 "Outdated Optimize Dep": `npm run dev:reset` (xóa cache + --force), hoặc `npm run dev:force`, hard-refresh (Ctrl+Shift+R).
 * - "Failed to fetch dynamically imported module": thường do tab cũ / server restart — F5 hoặc để App dùng lazyImport tự reload 1 lần.
 * - Project trên OneDrive: nếu watcher lỗi, chạy `set VITE_USE_POLLING=1&& npm run dev` (Windows CMD) hoặc `VITE_USE_POLLING=1 npm run dev` (bash).
 * - `ERR_CACHE_READ_FAILURE` (Chrome + OneDrive): DevTools → Network → Disable cache, Ctrl+Shift+R. Không unshift middleware (làm hỏng module/HMR).
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

/** Bỏ ETag từ Chrome trước khi Vite quyết định 304 — không đụng stack nội bộ. */
function disableBrowserHttpCache() {
  return {
    name: "disable-browser-http-cache",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        delete req.headers["if-none-match"];
        delete req.headers["if-modified-since"];
        next();
      });
    },
  };
}

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (env.IMGBB_API_KEY) process.env.IMGBB_API_KEY = env.IMGBB_API_KEY;
  if (env.IMGBB_UPLOAD_URL) process.env.IMGBB_UPLOAD_URL = env.IMGBB_UPLOAD_URL;
  if (env.FIREBASE_API_KEY) process.env.FIREBASE_API_KEY = env.FIREBASE_API_KEY;
  if (env.IMAGE_UPLOAD_SKIP_AUTH) {
    process.env.IMAGE_UPLOAD_SKIP_AUTH = env.IMAGE_UPLOAD_SKIP_AUTH;
  }

  const imageUploadMiddleware = createImageUploadMiddleware();

  const plugins = [
    disableBrowserHttpCache(),
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
  ];

  if (mode === "analyze") {
    const { visualizer } = await import("rollup-plugin-visualizer");
    plugins.push(
      visualizer({
        filename: "dist/bundle-stats.html",
        gzipSize: true,
        brotliSize: true,
        open: false,
      }),
    );
  }

  return {
    plugins,
    base: "/",
    server: {
      headers: {
        "Cache-Control": "no-store",
      },
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
      // Cảnh báo chunk >1MB — exceljs/xlsx/recharts lazy vẫn có thể vượt ngưỡng (chấp nhận được).
      chunkSizeWarningLimit: 1000,
    },
    test: {
      environment: "node",
      include: [
        "src/**/*.test.js",
        "server/**/*.test.mjs",
        "functions/**/*.test.mjs",
      ],
    },
  };
});
