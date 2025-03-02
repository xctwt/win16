import { useState, useEffect } from 'react';
import { Window } from './Windows';
import { Sparkles, Trophy, RotateCcw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

type Tab = 'game' | 'scores';
type Score = { name: string; score: number; date: string };

export function Clicker() {
  const [count, setCount] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [autoClickerCount, setAutoClickerCount] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>('game');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch high scores
  const { data: highScores = [] } = useQuery<Score[]>({
    queryKey: ['highScores'],
    queryFn: async () => {
      const response = await fetch('/api/scores');
      return response.json();
    },
  });

  // Save score mutation
  const saveScoreMutation = useMutation({
    mutationFn: async (data: { name: string; score: number }) => {
      const response = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['highScores'] });
      toast({
        title: 'Score saved!',
        description: 'Your score has been added to the leaderboard.',
      });
      setShowSaveDialog(false);
      resetGame();
    },
    onError: async (error: any) => {
      toast({
        title: 'Error saving score',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (autoClickerCount > 0) {
      const interval = setInterval(() => {
        setCount((c) => c + autoClickerCount * multiplier);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [autoClickerCount, multiplier]);

  const handleClick = () => {
    setCount(count + multiplier);
  };

  const buyMultiplier = () => {
    const cost = multiplier * 100;
    if (count >= cost) {
      setCount(count - cost);
      setMultiplier(multiplier + 1);
    }
  };

  const buyAutoClicker = () => {
    const cost = (autoClickerCount + 1) * 50;
    if (count >= cost) {
      setCount(count - cost);
      setAutoClickerCount(autoClickerCount + 1);
    }
  };

  const resetGame = () => {
    setCount(0);
    setMultiplier(1);
    setAutoClickerCount(0);
  };

  const handleReset = () => {
    if (count > 0) {
      setShowSaveDialog(true);
    } else {
      toast({
        title: 'Nothing to save',
        description: 'Score is 0. Game reset.',
        variant: 'destructive',
      });
      resetGame();
    }
  };

  const handleSaveScore = () => {
    if (!playerName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter your name to save your score.',
        variant: 'destructive',
      });
      return;
    }
    saveScoreMutation.mutate({ name: playerName, score: count });
  };

  const formatCount = (num: number): string => {
    if (num > 99000000) {
      return num.toExponential(2);
    }
    return num.toLocaleString();
  };

  return (
    <>
      <Window
        title="clicker"
        windowId="clicker"
        defaultPosition={{ x: 300, y: 200 }}
      >
        <div className="space-y-4 p-4" style={{ width: '300px' }}>
          <div className="flex gap-2 mb-4">
            <button
              className={`cs-button flex-1 ${
                activeTab === 'game'
                  ? 'border-[var(--cs-text)]'
                  : 'border-[var(--cs-border)]'
              }`}
              onClick={() => setActiveTab('game')}
            >
              Game
            </button>
            <button
              className={`cs-button flex-1 ${
                activeTab === 'scores'
                  ? 'border-[var(--cs-text)]'
                  : 'border-[var(--cs-border)]'
              }`}
              onClick={() => setActiveTab('scores')}
            >
              Leaderboard
            </button>
          </div>

          {activeTab === 'game' ? (
            <>
              <div className="text-center">
                <h2 className="text-2xl font-bold">{formatCount(count)}</h2>
                <p className="text-sm text-gray-400">
                  Multiplier: x{multiplier} | Auto-clickers: {autoClickerCount}
                </p>
              </div>

              <button
                className="cs-button w-full h-24 text-xl flex items-center justify-center gap-2"
                onClick={handleClick}
              >
                <Sparkles className="w-6 h-6" />
                Click! (+{multiplier})
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`cs-button ${
                    count < multiplier * 100 ? 'opacity-50' : ''
                  }`}
                  onClick={buyMultiplier}
                  disabled={count < multiplier * 100}
                >
                  Buy Multiplier
                  <span className="block text-sm">
                    Cost: {formatCount(multiplier * 100)}
                  </span>
                </button>

                <button
                  className={`cs-button ${
                    count < (autoClickerCount + 1) * 50 ? 'opacity-50' : ''
                  }`}
                  onClick={buyAutoClicker}
                  disabled={count < (autoClickerCount + 1) * 50}
                >
                  Buy Auto-clicker
                  <span className="block text-sm">
                    Cost: {formatCount((autoClickerCount + 1) * 50)}
                  </span>
                </button>
              </div>

              <button
                className="cs-button w-full flex items-center justify-center gap-2"
                onClick={handleReset}
              >
                <RotateCcw className="w-4 h-4" />
                Reset & Save Score
              </button>
            </>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {highScores.map((score, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center border border-cs-border p-2"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="font-bold min-w-[32px]">#{index + 1}</span>
                    <span className="truncate">{score.name}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold">
                      {formatCount(score.score)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(score.date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Window>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Your Score</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name..."
              />
            </div>
            <div className="text-center">
              <p className="text-lg">Your Score: {formatCount(count)}</p>
            </div>
          </div>
          <DialogFooter>
            <button className="cs-button" onClick={handleSaveScore}>
              Save Score
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
