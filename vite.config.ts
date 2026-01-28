import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    preact(),
    ...(process.env.ANALYZE
      ? [
          visualizer({
            filename: "./dist/stats.html",
            open: true,
            gzipSize: true,
            brotliSize: true,
            template: "treemap",
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "preact-vendor": ["preact", "preact/hooks"],
          "router-vendor": ["preact-iso"],
        },
      },
    },
    minify: "esbuild",
    chunkSizeWarningLimit: 500,
    sourcemap: false,
  },
});
