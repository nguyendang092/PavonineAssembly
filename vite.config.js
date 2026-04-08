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
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("firebase")) return "firebase";
          if (
            id.includes("react-dom") ||
            id.includes("/react/") ||
            id.includes("react-router")
          ) {
            return "react-vendor";
          }
          if (
            id.includes("recharts") ||
            id.includes("chart.js") ||
            id.includes("react-chartjs") ||
            id.includes("chartjs-plugin")
          ) {
            return "charts";
          }
          if (id.includes("node_modules/xlsx")) return "xlsx";
          if (id.includes("exceljs")) return "exceljs";
          if (id.includes("date-fns")) return "date-fns";
          if (id.includes("i18next") || id.includes("react-i18next"))
            return "i18n";
          return "vendor";
        },
      },
    },
  },
});
