import { useCallback, useEffect } from "preact/hooks";

// Module-level cache so the bundle is only fetched once
let cachedConfetti: ((options: object) => void) | null = null;

async function loadConfetti() {
  if (!cachedConfetti) {
    cachedConfetti = (await import("canvas-confetti")).default;
  }
  return cachedConfetti;
}

export function useConfetti() {
  // Preload during browser idle time so confetti is ready when needed
  useEffect(() => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => {
        loadConfetti();
      });
    } else {
      setTimeout(() => {
        loadConfetti();
      }, 2000);
    }
  }, []);

  const fireConfetti = useCallback(async () => {
    const confetti = await loadConfetti();

    // First burst - left side
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.1, y: 0.6 },
      colors: ["#a855f7", "#ec4899", "#f472b6", "#c084fc", "#818cf8"],
    });

    // Second burst - right side
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.9, y: 0.6 },
      colors: ["#a855f7", "#ec4899", "#f472b6", "#c084fc", "#818cf8"],
    });

    // Third burst - center with delay
    setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { x: 0.5, y: 0.5 },
        colors: ["#fbbf24", "#f59e0b", "#a855f7", "#ec4899", "#10b981"],
      });
    }, 150);

    // Extra celebration bursts
    setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 120,
        origin: { x: 0.3, y: 0.7 },
        colors: ["#a855f7", "#ec4899", "#f472b6"],
      });
      confetti({
        particleCount: 50,
        spread: 120,
        origin: { x: 0.7, y: 0.7 },
        colors: ["#a855f7", "#ec4899", "#f472b6"],
      });
    }, 300);
  }, []);

  return { fireConfetti };
}
