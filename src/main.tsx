import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./routeTree.gen";
import "./index.css";

// Loading component for code splitting
function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <p className="text-purple-200 text-sm">Loading...</p>
      </div>
    </div>
  );
}

// Initialize axe-core for accessibility testing in development
if (import.meta.env.DEV) {
  import("@axe-core/react")
    .then((axe) => {
      axe.default(React, ReactDOM, 1000);
    })
    .catch((err) => {
      console.error("Failed to load axe-core:", err);
    });
}

// Register service worker in production
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("SW registered:", registration);
      })
      .catch((error) => {
        console.error("SW registration failed:", error);
      });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={<LoadingSpinner />}>
      <RouterProvider router={router} />
    </Suspense>
  </React.StrictMode>,
);
