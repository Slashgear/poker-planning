import { Link } from "@tanstack/react-router";
import { useEffect } from "react";

export default function NotFound() {
  useEffect(() => {
    document.title = "404 - Not Found | Poker Planning";
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Not Found</h1>
        <p className="text-lg text-purple-200 mb-8 max-w-md mx-auto">
          The page you're looking for doesn't exist.
        </p>

        <Link
          to="/"
          className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-lg text-lg transition-colors shadow-lg"
        >
          Back to Home
        </Link>

        <footer className="mt-16 text-xs text-purple-300/40">
          <a
            href="https://github.com/Slashgear/poker-planning"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-purple-300/70 transition-colors"
          >
            GitHub
          </a>
          <span className="mx-2">·</span>
          <span>v2.7.0</span>
        </footer>
      </div>
    </main>
  );
}
