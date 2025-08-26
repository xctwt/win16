import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Window } from './Windows';
import { Drawing, type PowPayload } from '@shared/schema';
import { RefreshCw, ThumbsUp, ThumbsDown, ArrowUpDown } from 'lucide-react';

// Generate a unique client ID for this browser session
const generateClientId = () => {
  const storedClientId = localStorage.getItem('drawingClientId');
  if (storedClientId) return storedClientId;
  const newClientId = Math.random().toString(36).substring(2) + Date.now().toString(36);
  localStorage.setItem('drawingClientId', newClientId);
  return newClientId;
};

interface PowChallengeResponse {
  challengeId: string;
  prefix: string;
  difficulty: number; // leading zero hex chars required
  expiresAt: number;
}

async function fetchPowChallenge(): Promise<PowChallengeResponse> {
  const res = await fetch('/api/vote/pow-challenge');
  if (!res.ok) throw new Error('Failed to get challenge');
  return res.json();
}

async function solvePow(challenge: PowChallengeResponse, clientId: string, abortSignal: AbortSignal): Promise<PowPayload> {
  // We try nonces until we find a hash with required leading zeros
  const encoder = new TextEncoder();
  const targetPrefix = '0'.repeat(challenge.difficulty);
  let nonce = 0;
  while (true) {
    if (abortSignal.aborted) throw new Error('Aborted');
    const base = `${challenge.prefix}:${challenge.challengeId}:${clientId}:${nonce}`;
    const data = encoder.encode(base);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    if (hashHex.startsWith(targetPrefix)) {
      return { challengeId: challenge.challengeId, nonce, hash: hashHex };
    }
    nonce++;
    // Yield to UI every 500 iterations
    if (nonce % 500 === 0) await new Promise(r => setTimeout(r, 0));
  }
}

export function DrawingsViewer() {
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<'timestamp' | 'score'>('timestamp');
  const [powStatus, setPowStatus] = useState<string | null>(null);
  const [isMining, setIsMining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<Record<number, 'up' | 'down'>>(() => {
    try {
      const stored = localStorage.getItem('drawingVotes');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const miningControllerRef = useRef<AbortController | null>(null);
  const clientId = generateClientId();

  // Fetch drawings with sorting
  const { data: drawings = [], isLoading } = useQuery<Drawing[]>({
    queryKey: ['/api/drawings', sortBy],
    queryFn: async () => {
      const response = await fetch(`/api/drawings?sortBy=${sortBy}`);
      if (!response.ok) throw new Error('Failed to fetch drawings');
      return response.json();
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ drawingId, voteType }: { drawingId: number; voteType: 'up' | 'down' }) => {
      setError(null);
      setPowStatus('requesting challenge');
      setIsMining(true);

      const abortController = new AbortController();
      miningControllerRef.current = abortController;

      const challenge = await fetchPowChallenge();
      console.debug('PoW challenge received', challenge);
      setPowStatus(`mining PoW (difficulty ${challenge.difficulty})`);
      const pow = await solvePow(challenge, clientId, abortController.signal);
      console.debug('PoW solved', pow);

      setPowStatus('submitting vote');
      const response = await fetch(`/api/drawings/${drawingId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawingId, voteType, clientId, pow })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Vote failed');
      }
      return response.json();
    },
    onSuccess: (updated: Drawing) => {
      // Record vote locally (cannot change later)
      setUserVotes(prev => {
        if (prev[updated.id]) return prev; // already recorded
        const voteType = updated.upvotes + updated.downvotes > (updated.score >=0 ? updated.upvotes - updated.downvotes : 0) ? undefined : undefined; // placeholder
        return prev; // placeholder, real set below in handleVote via param
      });
      queryClient.invalidateQueries({ queryKey: ['/api/drawings'] });
    },
    onError: (e: any) => {
      setError(e.message || 'Error');
    },
    onSettled: () => {
      setIsMining(false);
      setPowStatus(null);
      miningControllerRef.current = null;
    }
  });

  const handleVote = (drawingId: number, voteType: 'up' | 'down') => {
    if (isMining) return;
    if (userVotes[drawingId]) return; // already voted
    // Optimistically store vote so buttons disable immediately
    setUserVotes(prev => {
      const next = { ...prev, [drawingId]: voteType };
      localStorage.setItem('drawingVotes', JSON.stringify(next));
      return next;
    });
    voteMutation.mutate({ drawingId, voteType });
  };

  const cancelMining = () => {
    const ctrl = miningControllerRef.current;
    if (ctrl) ctrl.abort();
    setIsMining(false);
    setPowStatus(null);
  };

  const handleRefresh = () => { queryClient.invalidateQueries({ queryKey: ['/api/drawings'] }); };
  const toggleSort = () => { setSortBy(prev => prev === 'timestamp' ? 'score' : 'timestamp'); };

  return (
    <Window title="drawings" windowId="drawings" defaultPosition={{ x: 75, y: 405 }}>
      <div className="w-80 space-y-2">
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-2">
            <span className="text-sm opacity-70">{drawings.length} drawing{drawings.length !== 1 ? 's' : ''}</span>
            <button className="cs-button p-1 text-xs flex items-center gap-1" onClick={toggleSort} title={`Currently sorted by ${sortBy === 'timestamp' ? 'oldest first' : 'highest score'}`}>
              <ArrowUpDown className="w-3 h-3" />
              {sortBy === 'timestamp' ? 'by date' : 'by score'}
            </button>
          </div>
          <button className={`cs-button p-1 ${isLoading ? 'animate-spin' : ''}`} onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {isMining && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-cs-background border border-cs-border p-4 rounded-sm max-w-xs w-full space-y-3">
              <div className="flex items-center gap-2">
                <div className="animate-spin"><RefreshCw className="w-4 h-4" /></div>
                <span className="text-sm">{powStatus}</span>
              </div>
              {error && <div className="text-xs text-red-500">{error}</div>}
              <button className="cs-button w-full" onClick={cancelMining}>Cancel</button>
            </div>
          </div>
        )}

        <div className="h-80 overflow-auto grid grid-cols-2 gap-2 p-2">
          {drawings.map(drawing => (
            <div key={drawing.id} className="border border-cs-border p-1">
              <img src={drawing.imageData} alt={`Drawing ${drawing.id}`} className="w-full h-auto" loading="lazy" />
              <div className="text-xs space-y-1 mt-1">
                <div className="font-bold">{drawing.name}</div>
                <div>by {drawing.author}</div>
                <div>{new Date(drawing.timestamp).toLocaleString()}</div>
                <div className="flex justify-between items-center mt-2">
                  <div className="text-xs font-bold">Score: {drawing.score}</div>
                  <div className="flex gap-1">
                    <button className="cs-button p-1" onClick={() => handleVote(drawing.id, 'up')} disabled={voteMutation.isPending || isMining || !!userVotes[drawing.id]} title="Upvote">
                      <ThumbsUp className="w-3 h-3" />
                    </button>
                    <button className="cs-button p-1" onClick={() => handleVote(drawing.id, 'down')} disabled={voteMutation.isPending || isMining || !!userVotes[drawing.id]} title="Downvote">
                      <ThumbsDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {drawings.length === 0 && !isLoading && (<div className="col-span-2 text-center text-sm opacity-70 py-8">No drawings yet</div>)}
          {isLoading && (<div className="col-span-2 text-center text-sm opacity-70 py-8">Loading...</div>)}
        </div>
      </div>
    </Window>
  );
}
