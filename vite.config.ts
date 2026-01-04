import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

const ReactCompilerConfig = {
  /* ... */
};

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]],
      },
    }),
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
          "react-vendor": ["react", "react-dom"],
          "router-vendor": ["@tanstack/react-router"],
          "query-vendor": ["@tanstack/react-query"],
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
