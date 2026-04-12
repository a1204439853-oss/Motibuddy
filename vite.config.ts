import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "path";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => {
  // Check if we're building the widget
  const isWidgetBuild = process.env.BUILD_TARGET === 'widget';
  
  return {
    plugins: [
      react(), 
      tsconfigPaths(),
      // Only use singlefile plugin for widget build
      isWidgetBuild ? viteSingleFile() : null
    ].filter(Boolean),
    base: '',
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          widget: resolve(__dirname, 'widget.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
  };
});
