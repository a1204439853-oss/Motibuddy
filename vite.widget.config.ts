import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "path";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [
    react(), 
    tsconfigPaths(),
    viteSingleFile() // Always use singlefile for widget
  ],
  base: './',
  build: {
    outDir: 'dist-widget',
    rollupOptions: {
      input: {
        widget: resolve(__dirname, 'widget.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
