import { useState, useEffect, useRef } from "react";
import { useParams } from "@tanstack/react-router";
import { useRoom } from "../hooks/useRoom";
import { useConfetti } from "../hooks/useConfetti";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

const FIBONACCI_VALUES = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, "?", "☕"];

// Member card component with remove button
function MemberCard({
  member,
  isCurrentUser,
  isRevealed,
  onRemove,
}: {
  member: { id: string; name: string; vote: number | string | null };
  isCurrentUser: boolean;
  isRevealed: boolean;
  onRemove: (id: string) => void;
}) {
  const hasVoted = member.vote !== null;
  const displayValue = isRevealed ? member.vote : hasVoted ? "?" : "-";

  return (
    <div
      className={`
      group relative bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center
      transition-all duration-200 hover:bg-white/15
      ${isCurrentUser ? "ring-2 ring-purple-400 shadow-lg shadow-purple-500/20" : ""}
    `}
    >
      {/* Remove button - appears on hover */}
      {!isCurrentUser && (
        <button
          onClick={() => onRemove(member.id)}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full text-white text-sm flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg"
          title="Remove member"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}

      {/* Vote display */}
      <div
        className={`
        text-3xl font-bold mb-2 h-10 flex items-center justify-center
        ${hasVoted ? "text-white" : "text-white/30"}
        ${isRevealed && hasVoted ? "animate-bounce-once" : ""}
      `}
      >
        {displayValue}
      </div>

      {/* Name */}
      <div className="text-sm text-purple-200 truncate font-medium">
        {member.name}
      </div>
      {isCurrentUser && (
        <div className="text-xs text-purple-400 mt-0.5">you</div>
      )}

      {/* Vote indicator */}
      <div
        className={`
        mt-2 h-1 rounded-full transition-all duration-300
        ${hasVoted ? "bg-green-400/60" : "bg-white/10"}
      `}
      />
    </div>
  );
}

export default function Room() {
  const { code } = useParams({ from: "/room/$code" });
  const {
    roomState,
    roomInfo,
    error,
    isConnected,
    join,
    vote,
    reveal,
    reset,
    removeMember,
    refetchInfo,
  } = useRoom(code);
  const { fireConfetti } = useConfetti();

  const [name, setName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState<number | string | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const previousShowResults = useRef(false);

  // Find current member's vote from roomState
  const members = roomState?.members || [];
  const currentMemberId = roomInfo?.currentMember?.id;
  const myVote = members.find((m) => m.id === currentMemberId)?.vote;
  const votedCount = members.filter((m) => m.vote !== null).length;

  // Sync selected value with server state
  useEffect(() => {
    if (myVote !== undefined && myVote !== "hidden" && myVote !== null) {
      setSelectedValue(myVote);
    } else if (myVote === null) {
      setSelectedValue(null);
    }
  }, [myVote]);

  // Check for consensus and fire confetti
  useEffect(() => {
    if (!roomState) return;

    const votes = roomState.members
      .map((m) => m.vote)
      .filter((v): v is number | string => v !== null && v !== "hidden");

    const hasConsensus =
      votes.length >= 2 && votes.every((v) => v === votes[0]);

    if (roomState.showResults && !previousShowResults.current && hasConsensus) {
      fireConfetti();
    }
    previousShowResults.current = roomState.showResults;
  }, [roomState, fireConfetti]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsJoining(true);
    setJoinError(null);

    const result = await join(name.trim());

    if (!result.success) {
      setJoinError(result.error || "Failed to join");
      setIsJoining(false);
      return;
    }

    setIsJoining(false);
    refetchInfo();
  };

  const handleVote = async (value: number | string) => {
    const newValue = selectedValue === value ? null : value;
    setSelectedValue(newValue);
    await vote(newValue);
  };

  const handleCopyUrl = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Keyboard shortcuts - must be called before any early returns
  useKeyboardShortcuts({
    onVote: handleVote,
    onReveal: reveal,
    onReset: reset,
    canReveal: votedCount > 0,
    showResults: roomState?.showResults || false,
  });

  // Error state
  if (error && !roomState) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center px-4">
          <h2 className="text-2xl font-bold text-white mb-4">Room Not Found</h2>
          <p className="text-purple-200 mb-6">{error}</p>
          <a
            href="/"
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Go Home
          </a>
        </div>
      </main>
    );
  }

  // Join form if not a member
  if (!roomInfo?.currentMember) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center px-4 w-full max-w-sm">
          <h2 className="text-2xl font-bold text-white mb-2">Join Room</h2>
          <p className="text-purple-200 mb-6">
            Room code: <span className="font-mono font-bold">{code}</span>
          </p>

          <form onSubmit={handleJoin} className="space-y-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
              maxLength={30}
            />

            {joinError && <p className="text-red-400 text-sm">{joinError}</p>}

            <button
              type="submit"
              disabled={isJoining || !name.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {isJoining ? "Joining..." : "Join Room"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Main room view
  const showResults = roomState?.showResults || false;
  const currentMember = roomInfo.currentMember;

  // Calculate statistics
  const numericVotes = members
    .map((m) => m.vote)
    .filter((v): v is number => typeof v === "number" && v !== 0);

  const average =
    numericVotes.length > 0
      ? numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length
      : 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-4">
        {/* Header */}
        <header className="text-center mb-4">
          <h1 className="text-2xl font-bold text-white mb-1">Poker Planning</h1>
          <div className="flex items-center justify-center gap-4">
            <p className="text-sm text-purple-200">
              Room: <span className="font-mono font-bold">{code}</span>
            </p>
            <button
              onClick={handleCopyUrl}
              className="text-xs bg-purple-600/50 hover:bg-purple-600 text-white px-3 py-1 rounded transition-colors"
            >
              {copied ? "Copied!" : "Copy URL"}
            </button>
          </div>
          {!isConnected && (
            <p className="text-xs text-yellow-400 mt-1">Reconnecting...</p>
          )}
        </header>

        {/* Team members */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          {members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              isCurrentUser={member.id === currentMember.id}
              isRevealed={showResults}
              onRemove={removeMember}
            />
          ))}
        </div>

        {/* Voting cards */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-purple-200 mb-3 text-center">
            Your vote:
          </h3>
          <div className="flex flex-wrap gap-3 justify-center">
            {FIBONACCI_VALUES.map((value) => (
              <button
                key={value}
                onClick={() => handleVote(value)}
                disabled={showResults}
                className={`
                  w-16 h-24 sm:w-20 sm:h-28 rounded-xl font-bold text-2xl sm:text-3xl transition-all
                  border-2 shadow-md
                  ${
                    selectedValue === value
                      ? "bg-purple-500 text-white scale-105 shadow-xl shadow-purple-500/30 border-purple-400"
                      : "bg-white/10 text-white hover:bg-white/20 border-white/20 hover:border-white/40"
                  }
                  ${showResults ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:scale-105"}
                `}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4 mb-4">
          <button
            onClick={reveal}
            disabled={showResults || votedCount === 0}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Reveal Votes ({votedCount}/{members.length})
          </button>
          <button
            onClick={reset}
            className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Statistics */}
        {showResults && members.length > 0 && (
          <div className="bg-white/5 rounded-xl p-4 mb-4">
            {/* Average */}
            {numericVotes.length > 0 && (
              <div className="text-center mb-4">
                <p className="text-purple-200">
                  Average:{" "}
                  <span className="font-bold text-white text-2xl">
                    {average.toFixed(1)}
                  </span>
                </p>
              </div>
            )}

            {/* Vote distribution bar chart */}
            {(() => {
              // Count votes by value
              const voteCounts = new Map<string | number, number>();
              members.forEach((m) => {
                if (m.vote !== null && m.vote !== "hidden") {
                  const count = voteCounts.get(m.vote) || 0;
                  voteCounts.set(m.vote, count + 1);
                }
              });

              // Don't show if less than 3 voters or everyone voted the same
              const totalVoters = Array.from(voteCounts.values()).reduce(
                (a, b) => a + b,
                0,
              );
              if (
                voteCounts.size === 0 ||
                totalVoters < 3 ||
                voteCounts.size === 1
              )
                return null;

              const maxCount = Math.max(...voteCounts.values());
              const sortedVotes = Array.from(voteCounts.entries()).sort(
                (a, b) => {
                  // Sort by value (numbers first, then strings)
                  const aNum = typeof a[0] === "number" ? a[0] : Infinity;
                  const bNum = typeof b[0] === "number" ? b[0] : Infinity;
                  return aNum - bNum;
                },
              );

              return (
                <div className="space-y-2 mt-6">
                  <h4 className="text-xs font-medium text-purple-300 text-center mb-4">
                    Vote Distribution
                  </h4>
                  <div className="flex items-end justify-center gap-3 px-4">
                    {sortedVotes.map(([value, count]) => {
                      const heightPx = (count / maxCount) * 120; // Max height 120px
                      return (
                        <div
                          key={value}
                          className="flex flex-col items-center gap-1.5 min-w-[48px]"
                        >
                          <span className="text-xs font-semibold text-purple-200 mb-1">
                            {count}
                          </span>
                          <div
                            className="w-12 bg-gradient-to-t from-purple-600 to-purple-400 rounded-t-lg transition-all duration-500 shadow-lg"
                            style={{ height: `${Math.max(heightPx, 12)}px` }}
                          />
                          <span className="text-base font-bold text-white mt-1">
                            {value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Keyboard shortcuts hint */}
        <div className="text-center mt-6 text-xs text-purple-300/60">
          <div className="inline-flex items-center gap-4 flex-wrap justify-center">
            <span>
              <kbd className="px-2 py-1 bg-white/10 rounded">1-9</kbd> Vote
            </span>
            <span>
              <kbd className="px-2 py-1 bg-white/10 rounded">V</kbd> Reveal
            </span>
            <span>
              <kbd className="px-2 py-1 bg-white/10 rounded">R</kbd> Reset
            </span>
          </div>
        </div>

        {/* Current user info */}
        <div className="text-center mt-4 text-xs text-purple-300/50">
          Logged in as: {currentMember.name}
        </div>

        <footer className="mt-8 text-center text-xs text-purple-300/40">
          <a
            href="https://github.com/Slashgear/poker-planning"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-purple-300/70 transition-colors"
          >
            GitHub
          </a>
          <span className="mx-2">·</span>
          <span>v2.3.0</span>
        </footer>
      </div>
    </main>
  );
}
