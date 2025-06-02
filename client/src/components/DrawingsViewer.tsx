// components/DrawingsViewer.tsx
import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Window } from "./Windows";
import { Drawing } from "@shared/schema";
import {
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  ArrowUpDown,
  AlertTriangle,
} from "lucide-react"; // Import icons
import { Turnstile } from "@marsidev/react-turnstile";

// Cloudflare Turnstile site key - directly use your key here for testing
const TURNSTILE_SITE_KEY = "0x4AAAAAAA_7no1519ReZQ3v"; // Your actual site key

// Generate a unique client ID for this browser session
const generateClientId = () => {
  const storedClientId = localStorage.getItem("drawingClientId");
  if (storedClientId) return storedClientId;

  const newClientId =
    Math.random().toString(36).substring(2) + Date.now().toString(36);
  localStorage.setItem("drawingClientId", newClientId);
  return newClientId;
};

export function DrawingsViewer() {
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<"timestamp" | "score">("timestamp");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [pendingVote, setPendingVote] = useState<{
    drawingId: number;
    voteType: "up" | "down";
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );
  const turnstileRef = useRef<any>(null);
  const clientId = generateClientId();

  // Fetch drawings with sorting
  const { data: drawings = [], isLoading } = useQuery<Drawing[]>({
    queryKey: ["/api/drawings", sortBy],
    queryFn: async () => {
      const response = await fetch(`/api/drawings?sortBy=${sortBy}`);
      if (!response.ok) throw new Error("Failed to fetch drawings");
      return response.json();
    },
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async ({
      drawingId,
      voteType,
      token,
    }: {
      drawingId: number;
      voteType: "up" | "down";
      token: string;
    }) => {
      const response = await fetch(`/api/drawings/${drawingId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voteType,
          clientId,
          turnstileToken: token,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to vote");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate drawings query to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/drawings"] });
      // Reset state
      setTurnstileToken(null);
      setIsVerifying(false);
      setPendingVote(null);
      setVerificationError(null);
    },
    onError: (error: Error) => {
      console.error("Vote error:", error);
      setVerificationError(error.message);
      // Reset Turnstile
      if (turnstileRef.current?.reset) {
        turnstileRef.current.reset();
      }
      // Keep the verification modal open with the error message
      setIsVerifying(true);
    },
  });

  // Handle Turnstile token verification
  useEffect(() => {
    if (turnstileToken && pendingVote) {
      voteMutation.mutate({
        drawingId: pendingVote.drawingId,
        voteType: pendingVote.voteType,
        token: turnstileToken,
      });
    }
  }, [turnstileToken, pendingVote]);

  // Reset Turnstile when verification is complete
  useEffect(() => {
    if (!isVerifying && turnstileRef.current?.reset) {
      turnstileRef.current.reset();
    }
  }, [isVerifying]);

  const handleVote = (drawingId: number, voteType: "up" | "down") => {
    setPendingVote({ drawingId, voteType });
    setIsVerifying(true);
    setVerificationError(null);
    // The invisible Turnstile will automatically execute when rendered
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/drawings"] });
  };

  const toggleSort = () => {
    setSortBy((prev) => (prev === "timestamp" ? "score" : "timestamp"));
  };

  const closeVerification = () => {
    setIsVerifying(false);
    setPendingVote(null);
    setVerificationError(null);
    setTurnstileToken(null);
    if (turnstileRef.current?.reset) {
      turnstileRef.current.reset();
    }
  };

  return (
    <Window
      title="drawings"
      windowId="drawings"
      defaultPosition={{ x: 75, y: 405 }}
    >
      <div className="w-80 space-y-2">
        {/* Header with refresh button and sort toggle */}
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-2">
            <span className="text-sm opacity-70">
              {drawings.length} drawing{drawings.length !== 1 ? "s" : ""}
            </span>
            <button
              className="cs-button p-1 text-xs flex items-center gap-1"
              onClick={toggleSort}
              title={`Currently sorted by ${sortBy === "timestamp" ? "oldest first" : "highest score"}`}
            >
              <ArrowUpDown className="w-3 h-3" />
              {sortBy === "timestamp" ? "by date" : "by score"}
            </button>
          </div>
          <button
            className={`cs-button p-1 ${isLoading ? "animate-spin" : ""}`}
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Invisible Turnstile verification */}
        {isVerifying && (
          <div className="hidden">
            <Turnstile
              ref={turnstileRef}
              siteKey={TURNSTILE_SITE_KEY}
              options={{
                action: "vote",
                theme: "light",
                size: "invisible",
                retry: "never",
              }}
              onSuccess={(token: string) => setTurnstileToken(token)}
              onError={() => {
                setVerificationError(
                  "Verification failed. Please try again later.",
                );
              }}
              onExpire={() => {
                setVerificationError("Verification expired. Please try again.");
              }}
            />
          </div>
        )}

        {/* Loading indicator for verification */}
        {isVerifying && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-cs-background border border-cs-border p-4 rounded-sm max-w-xs w-full">
              {verificationError ? (
                <>
                  <div className="text-red-500 mb-4">
                    <h3 className="text-sm font-bold mb-2">Error</h3>
                    <p className="text-xs">{verificationError}</p>
                  </div>
                  <button
                    className="cs-button mt-2 w-full"
                    onClick={closeVerification}
                  >
                    Close
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="animate-spin">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <span>Verifying your vote...</span>
                  </div>
                  <button
                    className="cs-button w-full"
                    onClick={closeVerification}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Drawings grid */}
        <div className="h-80 overflow-auto grid grid-cols-2 gap-2 p-2">
          {drawings.map((drawing) => (
            <div key={drawing.id} className="border border-cs-border p-1">
              <img
                src={drawing.imageData}
                alt={`Drawing ${drawing.id}`}
                className="w-full h-auto"
                loading="lazy"
              />
              <div className="text-xs space-y-1 mt-1">
                <div className="font-bold">{drawing.name}</div>
                <div>by {drawing.author}</div>
                <div>{new Date(drawing.timestamp).toLocaleString()}</div>

                {/* Vote controls */}
                <div className="flex justify-between items-center mt-2">
                  <div className="text-xs font-bold">
                    Score: {drawing.score}
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="cs-button p-1"
                      onClick={() => handleVote(drawing.id, "up")}
                      disabled={voteMutation.isPending || isVerifying}
                      title="Upvote"
                    >
                      <ThumbsUp className="w-3 h-3" />
                    </button>
                    <button
                      className="cs-button p-1"
                      onClick={() => handleVote(drawing.id, "down")}
                      disabled={voteMutation.isPending || isVerifying}
                      title="Downvote"
                    >
                      <ThumbsDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Empty state */}
          {drawings.length === 0 && !isLoading && (
            <div className="col-span-2 text-center text-sm opacity-70 py-8">
              No drawings yet
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="col-span-2 text-center text-sm opacity-70 py-8">
              Loading...
            </div>
          )}
        </div>
      </div>
    </Window>
  );
}
