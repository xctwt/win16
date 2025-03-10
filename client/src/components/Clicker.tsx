import { useState, useEffect, useRef, useCallback, useMemo, useReducer, memo } from 'react';
import { Window } from './Windows';
import {
  Sparkles,
  Trophy,
  RotateCcw,
  Crown,
  Clock,
  Zap,
  ArrowUp,
} from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import crypto from 'crypto-js';

type Tab = 'game' | 'scores';
type Score = {
  name: string;
  score: number;
  date: string;
  prestige?: number;
  color?: string;
};

// Define a type for click animations
type ClickAnimationData = {
  id: number;
  value: number;
  x: number;
  y: number;
  isCritical: boolean;
  timestamp?: number;
};

// Prestige levels and their colors
const PRESTIGE_LEVELS = [
  { name: 'None', color: 'text-foreground' },
  { name: 'Bronze', color: 'text-amber-600' },
  { name: 'Silver', color: 'text-gray-300' },
  { name: 'Gold', color: 'text-yellow-400' },
  { name: 'Platinum', color: 'text-cyan-200' },
  { name: 'Diamond', color: 'text-blue-300' },
  { name: 'Master', color: 'text-purple-400' },
  { name: 'Grandmaster', color: 'text-red-500' },
];

// Animation for click effects
function ClickAnimation({ value, x, y, isCritical = false }: { value: number; x: number; y: number; isCritical?: boolean }) {
  const [opacity, setOpacity] = useState(1);
  const [posY, setPosY] = useState(y);
  const [posX, setPosX] = useState(x);
  const [scale, setScale] = useState(1);
  
  // Generate random values for this specific animation instance
  const randomFactors = useRef({
    xSpeed: Math.random() * 2 - 1,  // Random value between -1 and 1
    ySpeed: -(Math.random() * 0.5 + 0.5),  // Random upward speed
    wobble: Math.random() * 6 + 2,  // Random wobble frequency
    wobbleAmount: Math.random() * 15 + 5,  // Random wobble amount
    path: Math.floor(Math.random() * 3)  // Random path type (0, 1, or 2)
  });

  useEffect(() => {
    // Use requestAnimationFrame for smoother animation
    let animationFrameId: number;
    let startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      // Complete animation in 800ms
      const progress = Math.min(elapsed / 800, 1);
      
      setOpacity(1 - progress);
      
      // Apply different movement patterns based on random path type
      const { xSpeed, ySpeed, wobble, wobbleAmount, path } = randomFactors.current;
      
      // Base vertical movement (always goes up)
      const baseYMovement = y + (ySpeed * progress * 100);
      
      // Different horizontal movement patterns
      let newX;
      if (path === 0) {
        // Zigzag pattern
        newX = x + (Math.sin(progress * wobble) * wobbleAmount);
      } else if (path === 1) {
        // Curved path
        newX = x + (xSpeed * progress * 40);
      } else {
        // Spiral-like
        newX = x + (Math.sin(progress * wobble) * wobbleAmount * (1 - progress));
      }
      
      setPosY(baseYMovement);
      setPosX(newX);
      setScale(1 + progress * 0.5); // Grow slightly as it rises
      
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };
    
    animationFrameId = requestAnimationFrame(animate);
    
    return () => cancelAnimationFrame(animationFrameId);
  }, [x, y]);

  if (opacity <= 0) return null;

  return (
    <div
      className={`fixed pointer-events-none font-bold ${
        isCritical ? 'text-yellow-400 dark:text-yellow-400' : 'text-foreground'
      }`}
      style={{
        left: posX,
        top: posY,
        opacity,
        transform: `scale(${isCritical ? 1.5 * scale : scale})`,
        zIndex: 10000,
        textShadow: isCritical ? '0 0 8px rgba(255, 215, 0, 0.8)' : '0 0 4px rgba(128, 128, 128, 0.5)',
        fontSize: '16px',
      }}
    >
      +{value}
    </div>
  );
}

export const Clicker = memo(function Clicker() {
  const [count, setCount] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [autoClickerCount, setAutoClickerCount] = useState(0);
  const [autoClickerFrequency, setAutoClickerFrequency] = useState(1); // clicks per second
  const [activeTab, setActiveTab] = useState<Tab>('game');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [selectedSeason, setSelectedSeason] = useState<string>('current');
  const [prestige, setPrestige] = useState(0);
  const [criticalChance, setCriticalChance] = useState(0.05); // 5% base chance
  const [criticalMultiplier, setCriticalMultiplier] = useState(5); // 5x base critical multiplier
  
  // Replaced useState with useReducer for clickAnimations
  const [clickAnimations, dispatchClickAnimations] = useReducer(
    (state: ClickAnimationData[], action: { type: string; payload: any }) => {
      switch (action.type) {
        case 'ADD_ANIMATION':
          return [...state, action.payload];
        case 'REMOVE_ANIMATION':
          return state.filter(anim => anim.id !== action.payload.id);
        case 'REMOVE_OLD_ANIMATIONS':
          return state.filter(anim => 
            anim.timestamp && anim.timestamp > action.payload.timestamp
          );
        default:
          return state;
      }
    },
    []
  );
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Memoized defaultPosition
  const defaultPosition = useMemo(() => ({ x: 75, y: 130 }), []);

  // Calculate current prestige level
  const currentPrestigeLevel = useMemo(() => Math.min(prestige, PRESTIGE_LEVELS.length - 1), [prestige]);
  
  // Memoize prestige-related values
  const prestigeColor = useMemo(() => PRESTIGE_LEVELS[currentPrestigeLevel].color, [currentPrestigeLevel]);
  const prestigeName = useMemo(() => PRESTIGE_LEVELS[currentPrestigeLevel].name, [currentPrestigeLevel]);

  // Memoized formatCount function
  const formatCount = useCallback((num: number | null | undefined): string => {
    // Handle null or undefined values
    if (num === null || num === undefined) {
      console.warn('Attempted to format null or undefined number');
      return '0';
    }

    // Handle NaN
    if (isNaN(num)) {
      console.warn('Attempted to format NaN');
      return '0';
    }

    if (num > 99000000) {
      return num.toExponential(2);
    }
    return num.toLocaleString();
  }, []);

  // Helper function to get the appropriate CSS class for a score's color
  const getScoreColorClass = useCallback((scoreColor?: string): string => {
    if (!scoreColor) return '';

    // Handle the theme-adaptive color
    if (scoreColor === 'theme-adaptive') {
      return 'text-foreground';
    }

    return `text-${scoreColor}`;
  }, []);

  // Save score mutation
  const saveScoreMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      score: number;
      prestige: number;
      color: string;
      timestamp?: number;
      token?: string;
    }) => {
      // Log the data being sent
      console.log('Sending score data to server:', {
        ...data,
        token: data.token ? data.token.substring(0, 10) + '...' : undefined,
      });

      const response = await fetch('/api/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error saving score');
      }

      return response.json();
    },
    onSuccess: () => {
      setShowSaveDialog(false);
      toast({
        title: 'Score saved!',
        description: 'Your score has been saved to the leaderboard.',
      });
      queryClient.invalidateQueries({ queryKey: ['scores'] });
    },
    onError: (error: Error) => {
      console.error('Error saving score:', error);
      toast({
        title: 'Error saving score',
        description:
          error.message || 'Failed to save your score. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Helper functions for score saving
  const hashString = useCallback((str: string): string => {
    return crypto.SHA256(str).toString();
  }, []);

  const generateVerificationToken = useCallback(
    (name: string, score: number, prestige: number): { timestamp: number, token: string } => {
      const timestamp = Date.now();
      // Match the server's token format: hash(timestamp:score)
      const tokenData = `${timestamp}:${score}`;
      return {
        timestamp,
        token: hashString(tokenData)
      };
    },
    [hashString]
  );

  const resetGame = useCallback(() => {
    setCount(0);
    setMultiplier(1);
    setAutoClickerCount(0);
    setAutoClickerFrequency(1);
    setCriticalChance(0.05);
    setCriticalMultiplier(5);
    setShowSaveDialog(false);
    toast({
      title: 'Game Reset',
      description: 'Your game has been reset. Starting fresh!',
    });
  }, [toast]);

  const handleSaveScore = useCallback(async () => {
    if (!playerName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter your name to save your score.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { timestamp, token } = generateVerificationToken(playerName, count, prestige);
      
      const prestigeLevel = Math.min(prestige, PRESTIGE_LEVELS.length - 1);
      const prestigeColor = PRESTIGE_LEVELS[prestigeLevel].color.replace('text-', '');
      
      const submissionData = {
        name: playerName,
        score: count,
        prestige,
        color: prestigeColor,
        timestamp,
        token,
      };

      console.log('Submitting score:', {
        ...submissionData,
        token: token.substring(0, 10) + '...',
      });

      await saveScoreMutation.mutateAsync(submissionData);
      
      // Reset game after successful submission
      resetGame();
      // saveScoreMutation handles the error toast
    } catch (error) {
      console.error('Error in handleSaveScore:', error);
    }
  }, [playerName, count, prestige, generateVerificationToken, saveScoreMutation, resetGame, toast]);

  // Fetch seasons
  const { data: seasonsData = { seasons: [1, 2], currentSeason: 2 } } = useQuery({
    queryKey: ['seasons'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/seasons');
        const data = await response.json();

        // If we're on 'current', update to show what the current season actually is
        if (selectedSeason === 'current' && data.currentSeason) {
          setSelectedSeason(data.currentSeason.toString());
        }

        return data;
      } catch (error) {
        console.error('Error fetching seasons:', error);
        return { seasons: [1, 2], currentSeason: 2 };
      }
    },
  });

  // Fetch high scores
  const { data: highScores = [] } = useQuery<Score[]>({
    queryKey: ['highScores', selectedSeason],
    queryFn: async () => {
      const response = await fetch(`/api/scores?season=${selectedSeason}`);
      const data = await response.json();

      // Sort by prestige first, then by score
      if (Array.isArray(data)) {
        return data.sort((a, b) => {
          // First sort by prestige (higher first)
          const prestigeDiff = (b.prestige || 0) - (a.prestige || 0);
          if (prestigeDiff !== 0) return prestigeDiff;

          // Then sort by score (higher first)
          return b.score - a.score;
        });
      }

      // Ensure we always return an array
      return Array.isArray(data) ? data : [];
    },
  });

  // Memoized autoClickerHandler
  const autoClickerHandler = useCallback(() => {
    setCount(c => c + autoClickerCount * multiplier);
  }, [autoClickerCount, multiplier]);

  useEffect(() => {
    if (autoClickerCount > 0) {
      const interval = setInterval(autoClickerHandler, 1000 / autoClickerFrequency);
      return () => clearInterval(interval);
    }
  }, [autoClickerHandler, autoClickerFrequency, autoClickerCount]);

  // Remove click animations using timestamp-based cleanup
  useEffect(() => {
    if (clickAnimations.length > 0) {
      const now = Date.now();
      const timer = setTimeout(() => {
        // Use the reducer to filter out old animations
        dispatchClickAnimations({
          type: 'REMOVE_OLD_ANIMATIONS',
          payload: { timestamp: now - 1000 }
        });
      }, 100); // Adjust as needed
      return () => clearTimeout(timer);
    }
  }, [clickAnimations]);

  // handleClick function
  const handleClick = useCallback(
    (e?: React.MouseEvent) => {
      // Determine if it's a critical hit
      const isCritical = Math.random() < criticalChance;
      const clickValue = isCritical ? multiplier * criticalMultiplier : multiplier;

      // Add the value to the score
      setCount(c => c + clickValue);

      // Get click position
      let x, y;

      if (e) {
        // Use exact click position
        x = e.clientX;
        y = e.clientY;
      } else if (buttonRef.current) {
        // Fallback to button center
        const rect = buttonRef.current.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      } else {
        // Last resort fallback
        x = window.innerWidth / 2;
        y = window.innerHeight / 2;
      }

      // Generate a truly unique ID for each animation
      const baseId = Date.now() + Math.random();

      // Create animations based on hit type
      if (isCritical) {
        // For small critical hits (< 10), just show one big number
        if (clickValue < 10) {
          dispatchClickAnimations({
            type: 'ADD_ANIMATION',
            payload: {
              id: baseId + Math.random(),
              value: clickValue,
              x: x,
              y: y,
              isCritical: true,
              timestamp: Date.now(),
            },
          });
        } else {
          // For larger critical hits, show multiple particles
          const baseParticleCount = 3;
          const maxExtraParticles = Math.min(4, Math.floor(Math.log10(clickValue)));
          const particleCount = baseParticleCount + maxExtraParticles;

          const newAnimations: ClickAnimationData[] = [];

          // Always show the main value in the first particle
          newAnimations.push({
            id: baseId + Math.random(),
            value: clickValue,
            x: x,
            y: y,
            isCritical: true,
            timestamp: Date.now(),
          });

          // For secondary particles, ensure they show meaningful values
          for (let i = 1; i < particleCount; i++) {
            // Add more random offset for a true popcorn effect
            const offsetX = Math.random() * 60 - 30;
            const offsetY = Math.random() * 40 - 20;

            // For critical hits, secondary particles should show at least 25% of the main value
            // This ensures even small crits (like 5) won't show tiny numbers
            const minValue = Math.max(2, Math.floor(clickValue * 0.25));
            const maxValue = Math.floor(clickValue * 0.75);
            const particleValue = Math.floor(Math.random() * (maxValue - minValue + 1) + minValue);

            newAnimations.push({
              id: baseId + i + Math.random(),
              value: particleValue,
              x: x + offsetX,
              y: y + offsetY,
              isCritical: true,
              timestamp: Date.now(),
            });
          }

          newAnimations.forEach(anim => {
            dispatchClickAnimations({
              type: 'ADD_ANIMATION',
              payload: anim,
            });
          });
        }
      } else {
        // For non-critical hits, add 1-3 particles based on multiplier size
        const particleCount = multiplier > 100 ? 3 : multiplier > 10 ? 2 : 1;
        const newAnimations: ClickAnimationData[] = [];

        // For regular hits, just show the actual value
        newAnimations.push({
          id: baseId + Math.random(),
          value: clickValue,
          x: x,
          y: y,
          isCritical: false,
          timestamp: Date.now(),
        });

        // Add smaller secondary particles only for larger hits
        if (clickValue > 10) {
          for (let i = 1; i < particleCount; i++) {
            const offsetX = Math.random() * 30 - 15;
            const offsetY = Math.random() * 20 - 10;

            // For non-critical secondary particles, show 33-66% of the main value
            const particleValue = Math.floor(clickValue * (0.33 + Math.random() * 0.33));

            newAnimations.push({
              id: baseId + i + Math.random(),
              value: particleValue,
              x: x + offsetX,
              y: y + offsetY,
              isCritical: false,
              timestamp: Date.now(),
            });
          }
        }

        newAnimations.forEach(anim => {
          dispatchClickAnimations({
            type: 'ADD_ANIMATION',
            payload: anim,
          });
        });
      }
    },
    [multiplier, criticalChance, criticalMultiplier, dispatchClickAnimations, setCount, buttonRef]
  );

  // Memoized cost calculations
  const multiplierCost = useMemo(() => Math.floor(multiplier * 100 * Math.pow(1.2, multiplier)), [multiplier]);
  const autoClickerCost = useMemo(
    () => Math.floor((autoClickerCount + 1) * 50 * Math.pow(1.3, autoClickerCount)),
    [autoClickerCount]
  );
  const autoClickerFrequencyCost = useMemo(
    () => Math.floor(autoClickerFrequency * 200 * Math.pow(2, autoClickerFrequency)),
    [autoClickerFrequency]
  );
  const critChanceCost = useMemo(
    () => Math.floor(criticalChance * 10000 * Math.pow(1.5, criticalChance * 10)),
    [criticalChance]
  );
  const critMultiplierCost = useMemo(
    () => Math.floor(criticalMultiplier * 300 * Math.pow(1.4, criticalMultiplier - 5)),
    [criticalMultiplier]
  );

  const buyMultiplier = useCallback(() => {
    if (count >= multiplierCost) {
      setCount(c => c - multiplierCost);
      setMultiplier(m => m + 1);
    }
  }, [count, multiplierCost]);

  const buyAutoClicker = useCallback(() => {
    if (count >= autoClickerCost) {
      setCount(c => c - autoClickerCost);
      setAutoClickerCount(ac => ac + 1);
    }
  }, [count, autoClickerCost]);

  const upgradeAutoClickerFrequency = useCallback(() => {
    if (count >= autoClickerFrequencyCost) {
      setCount(c => c - autoClickerFrequencyCost);
      setAutoClickerFrequency(freq => freq + 0.5);
    }
  }, [count, autoClickerFrequencyCost]);

  const upgradeCriticalChance = useCallback(() => {
    if (count >= critChanceCost && criticalChance < 0.5) {
      setCount(c => c - critChanceCost);
      setCriticalChance(cc => Math.min(cc + 0.05, 0.5)); // Cap at 50%
    }
  }, [count, critChanceCost, criticalChance]);

  const upgradeCriticalMultiplier = useCallback(() => {
    if (count >= critMultiplierCost) {
      setCount(c => c - critMultiplierCost);
      setCriticalMultiplier(cm => cm + 1);
    }
  }, [count, critMultiplierCost]);

  // Calculate prestige cost based on current prestige level
  const getPrestigeCost = useCallback((currentPrestige: number): number => {
    // Base cost is 1 million, then 10x for each level
    return 1000000 * Math.pow(10, currentPrestige);
  }, []);

  const performPrestige = useCallback(() => {
    const prestigeCost = getPrestigeCost(prestige);

    if (count < prestigeCost) {
      toast({
        title: 'Not enough points',
        description: `You need at least ${formatCount(
          prestigeCost
        )} points to prestige.`,
        variant: 'destructive',
      });
      return;
    }

    // Increase prestige level
    const newPrestige = prestige + 1;
    setPrestige(newPrestige);

    // Reset game but keep prestige level
    setCount(0);
    setMultiplier(1 + Math.floor(newPrestige / 2)); // Prestige bonus
    setAutoClickerCount(0);
    setAutoClickerFrequency(1);
    setCriticalChance(0.05 + newPrestige * 0.01); // Prestige bonus
    setCriticalMultiplier(5 + newPrestige); // Prestige bonus

    toast({
      title: 'Prestige Level Up!',
      description: `You are now ${
        PRESTIGE_LEVELS[Math.min(newPrestige, PRESTIGE_LEVELS.length - 1)].name
      } prestige!`,
    });
  }, [count, prestige, getPrestigeCost, toast, formatCount]);

  const handleReset = useCallback(async () => {
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
  }, [count, resetGame, toast]);

  // Memoized save dialog
  const saveDialog = useMemo(() => (
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
              onChange={e => setPlayerName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>
          <div className="space-y-2">
            <p className={`text-lg ${prestigeColor}`}>
              Score: {formatCount(count)}
            </p>
            {prestige > 0 && (
              <p className={`text-sm ${prestigeColor}`}>
                Prestige Level: {prestigeName}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <button
            className="cs-button"
            onClick={handleSaveScore}
            disabled={saveScoreMutation.isPending}
          >
            {saveScoreMutation.isPending ? 'Saving...' : 'Save Score'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ), [
    showSaveDialog,
    setShowSaveDialog,
    playerName,
    prestigeColor,
    count,
    prestige,
    prestigeName,
    handleSaveScore,
    saveScoreMutation.isPending,
  ]);

  const MemoizedSparklesLarge = useMemo(() => <Sparkles className="w-6 h-6" />, []);
  const MemoizedSparklesSmall = useMemo(() => <Sparkles className="w-4 h-4" />, []);
  const MemoizedCrownSmall = useMemo(() => <Crown className="w-4 h-4 inline mr-1" />, []);
  const MemoizedRotateCcw = useMemo(() => <RotateCcw className="w-4 h-4" />, []);

  return (
    <>
      {/* Click animations container - positioned fixed relative to viewport with highest z-index */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 10000 }}
      >
        {clickAnimations.map((anim: ClickAnimationData) => (
          <ClickAnimation key={anim.id} value={anim.value} x={anim.x} y={anim.y} isCritical={anim.isCritical} />
        ))}
      </div>

      <Window
        title="clicker - season 2"
        windowId="clicker"
        defaultPosition={defaultPosition}
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
              <div className="text-center relative">
                <div className="absolute top-0 right-0">
                  {prestige > 0 && (
                    <div className={`flex items-center gap-1 ${prestigeColor}`}>
                      {MemoizedCrownSmall}
                      <span>{prestigeName}</span>
                    </div>
                  )}
                </div>
                <h2 className={`text-2xl font-bold ${prestigeColor}`}>{formatCount(count)}</h2>
                <p className="text-sm text-gray-400">
                  Multiplier: x{multiplier} | Auto-clickers: {autoClickerCount} (
                  {autoClickerFrequency.toFixed(1)}/s)
                </p>
                <p className="text-xs text-gray-400">
                  Critical: {Math.round(criticalChance * 100)}% chance for x
                  {criticalMultiplier}
                </p>
              </div>

              <button
                ref={buttonRef}
                className="cs-button w-full h-24 text-xl flex items-center justify-center gap-2 relative overflow-hidden transition-transform active:scale-95"
                onClick={handleClick}
              >
                {MemoizedSparklesLarge}
                Click! (+{multiplier})
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`cs-button ${count < multiplierCost ? 'opacity-50' : ''}`}
                  onClick={buyMultiplier}
                  disabled={count < multiplierCost}
                >
                  <div className="flex items-center gap-1">
                    <ArrowUp className="w-4 h-4" />
                    <span>Multiplier</span>
                  </div>
                  <span className="block text-sm">
                    {formatCount(multiplierCost)}
                  </span>
                </button>

                <button
                  className={`cs-button ${count < autoClickerCost ? 'opacity-50' : ''}`}
                  onClick={buyAutoClicker}
                  disabled={count < autoClickerCost}
                >
                  <div className="flex items-center gap-1">
                    <Zap className="w-4 h-4" />
                    <span>Auto-clicker</span>
                  </div>
                  <span className="block text-sm">
                    {formatCount(autoClickerCost)}
                  </span>
                </button>

                <button
                  className={`cs-button ${count < autoClickerFrequencyCost ? 'opacity-50' : ''}`}
                  onClick={upgradeAutoClickerFrequency}
                  disabled={
                    count < autoClickerFrequencyCost || autoClickerCount === 0
                  }
                >
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>Auto CPS</span>
                  </div>
                  <span className="block text-sm">
                    {formatCount(autoClickerFrequencyCost)}
                  </span>
                </button>

                <button
                  className={`cs-button ${count < critChanceCost || criticalChance >= 0.5 ? 'opacity-50' : ''}`}
                  onClick={upgradeCriticalChance}
                  disabled={count < critChanceCost || criticalChance >= 0.5}
                >
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-4 h-4" />
                    <span>Crit Chance</span>
                  </div>
                  <span className="block text-sm">
                    {criticalChance >= 0.45 ? 'Sold Out' : formatCount(critChanceCost)}
                  </span>
                </button>

                <button
                  className={`cs-button ${count < critMultiplierCost ? 'opacity-50' : ''}`}
                  onClick={upgradeCriticalMultiplier}
                  disabled={count < critMultiplierCost}
                >
                  <div className="flex items-center gap-1">
                    <Zap className="w-4 h-4" />
                    <span>Crit Damage</span>
                  </div>
                  <span className="block text-sm">
                    {formatCount(critMultiplierCost)}
                  </span>
                </button>

                <button
                  className={`cs-button ${count < getPrestigeCost(prestige) ? 'opacity-50' : ''}`}
                  onClick={performPrestige}
                  disabled={count < getPrestigeCost(prestige)}
                >
                  <div className="flex items-center gap-1">
                    <Crown className="w-4 h-4" />
                    <span>Prestige</span>
                  </div>
                  <span className="block text-sm">{formatCount(getPrestigeCost(prestige))}</span>
                </button>
              </div>

              <button
                className="cs-button w-full flex items-center justify-center gap-2"
                onClick={handleReset}
              >
                {MemoizedRotateCcw}
                Reset & Save Score
              </button>
            </>
          ) : (
            <>
              <div className="mb-4">
                <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Season">
                      {`Season ${selectedSeason}`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {seasonsData?.seasons?.map((season: number) => (
                      <SelectItem key={season} value={season.toString()}>
                        Season {season} {season === seasonsData.currentSeason ? '(Current)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {highScores.length > 0 ? (
                  highScores.map((score, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center border border-cs-border p-2"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="font-bold min-w-[32px]">#{index + 1}</span>
                        <span className={`truncate ${getScoreColorClass(score.color)}`}>
                          {score.prestige && score.prestige > 0 ? (
                            <Crown className="w-3 h-3 inline mr-1" />
                          ) : null}
                          {score.name}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`font-bold ${getScoreColorClass(score.color)}`}>
                          {score && score.score !== undefined && score.score !== null 
                            ? formatCount(score.score) 
                            : '0'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {score && score.date 
                            ? new Date(score.date).toLocaleDateString() 
                            : 'Unknown date'}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center p-4 text-gray-400">
                    No scores for this season yet
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Window>

      {saveDialog}
    </>
  );
});
