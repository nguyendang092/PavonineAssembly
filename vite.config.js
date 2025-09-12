import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // quan trọng khi build để deploy trên server
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // dùng @ để import src dễ dàng
    },
  },
  build: {
    outDir: 'dist', // thư mục build
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    open: true,
    strictPort: true,
    // historyApiFallback: true // chỉ cần nếu dev server muốn fallback route
  }
});
