import { render } from "preact";
import { App } from "./router";
import "./index.css";

// Unregister any existing service workers and clear caches
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().then(() => {
        console.log("Service worker unregistered");
      });
    }
  });

  // Clear all caches created by the service worker
  if ("caches" in window) {
    caches.keys().then((cacheNames) => {
      cacheNames.forEach((cacheName) => {
        if (cacheName.startsWith("poker-planning-")) {
          caches.delete(cacheName).then(() => {
            console.log("Cache deleted:", cacheName);
          });
        }
      });
    });
  }
}

render(<App />, document.getElementById("root")!);
