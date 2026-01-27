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
            template: "treemap", // treemap, sunburst, network
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
    // Optimize bundle splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          "preact-vendor": ["preact", "preact/hooks"],
          "router-vendor": ["preact-iso"],
        },
      },
    },
    // Use esbuild for fast minification (drop_console handled via plugin)
    minify: "esbuild",
    // Improve chunk size warnings
    chunkSizeWarningLimit: 500,
    // Enable source maps for production debugging (optional)
    sourcemap: false,
  },
});
