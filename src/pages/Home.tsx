import { useState } from "preact/hooks";
import { useLocation } from "preact-iso";
import { createRoom } from "../hooks/useRoom";
import { APP_VERSION } from "../config";

export default function Home() {
  const { route } = useLocation();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    setError(null);

    const result = await createRoom();

    if ("error" in result) {
      setError(result.error);
      setIsCreating(false);
      return;
    }

    route(`/room/${result.code}`);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Poker Planning</h1>
        <p className="text-lg text-purple-200 mb-8 max-w-md mx-auto">
          Collaborative estimation with the Fibonacci sequence. Create a room and invite your team.
        </p>

        <button
          onClick={handleCreateRoom}
          disabled={isCreating}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-lg text-lg transition-colors shadow-lg"
        >
          {isCreating ? "Creating..." : "Create a Room"}
        </button>

        {error && <p className="mt-4 text-red-400">{error}</p>}

        <section className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-white mb-6">Why use this tool?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            <div className="bg-white/5 rounded-lg p-4 border border-purple-500/20">
              <h3 className="font-medium text-purple-200 mb-2">No account required</h3>
              <p className="text-sm text-purple-300/70">
                Just create a room and share the code. No signup, no login, no friction.
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 border border-purple-500/20">
              <h3 className="font-medium text-purple-200 mb-2">
                Free, open-source & self-hostable
              </h3>
              <p className="text-sm text-purple-300/70">
                No premium features, no limits.{" "}
                <a
                  href="https://github.com/Slashgear/poker-planning/blob/main/LICENSE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-300 hover:text-purple-100 underline"
                >
                  MIT licensed
                </a>
                , easy to{" "}
                <a
                  href="https://github.com/Slashgear/poker-planning#quick-start"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-300 hover:text-purple-100 underline"
                >
                  deploy on your own server
                </a>
                .
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 border border-purple-500/20">
              <h3 className="font-medium text-purple-200 mb-2">Privacy-first, hosted in Europe</h3>
              <p className="text-sm text-purple-300/70">
                No tracking, no analytics, no data sold. This instance runs on{" "}
                <a
                  href="https://www.scaleway.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-300 hover:text-purple-100 underline"
                >
                  Scaleway
                </a>{" "}
                servers in Europe.
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 border border-purple-500/20">
              <h3 className="font-medium text-purple-200 mb-2">Lightweight & fast</h3>
              <p className="text-sm text-purple-300/70">
                Under 20KB transferred. Built with Preact, installable as a PWA.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-8 text-sm text-purple-300/70">
          <p>Rooms expire after 2 hours of inactivity</p>
        </div>

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
          <a
            href="https://github.com/sponsors/Slashgear"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-purple-300/70 transition-colors"
          >
            Sponsor
          </a>
          <span className="mx-2">·</span>
          <span>v{APP_VERSION}</span>
        </footer>
      </div>
    </main>
  );
}
