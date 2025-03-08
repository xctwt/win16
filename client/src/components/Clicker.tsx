import { useState, useEffect, useRef } from 'react';
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
function ClickAnimation({ value, x, y }: { value: number; x: number; y: number }) {
  const [opacity, setOpacity] = useState(1);
  const [posY, setPosY] = useState(y);
  const [posX, setPosX] = useState(x);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    // Faster animation for better feedback
    const timer = setInterval(() => {
      setOpacity((prev) => prev - 0.08);
      setPosY((prev) => prev - 3);
      // Add a slight random horizontal movement
      setPosX((prev) => prev + (Math.random() * 3 - 1.5));
      setScale((prev) => prev + 0.03); // Grow slightly as it rises
    }, 30);

    return () => clearInterval(timer);
  }, []);

  if (opacity <= 0) return null;

  const isCritical = value > 10;

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

export function Clicker() {
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
  const [clickAnimations, setClickAnimations] = useState<
    Array<{ id: number; value: number; x: number; y: number }>
  >([]);
  const [nextAnimationId, setNextAnimationId] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  useEffect(() => {
    if (autoClickerCount > 0) {
      const interval = setInterval(() => {
        setCount((c) => c + autoClickerCount * multiplier);
      }, 1000 / autoClickerFrequency);
      return () => clearInterval(interval);
    }
  }, [autoClickerCount, multiplier, autoClickerFrequency]);

  // Remove click animations after they fade out
  useEffect(() => {
    if (clickAnimations.length > 0) {
      const timer = setTimeout(() => {
        setClickAnimations((prev) => prev.slice(1));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [clickAnimations]);

  const handleClick = (e?: React.MouseEvent) => {
    // Determine if it's a critical hit
    const isCritical = Math.random() < criticalChance;
    const clickValue = isCritical ? multiplier * criticalMultiplier : multiplier;

    // Add the value to the score
    setCount(count + clickValue);

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

    // Add multiple animations for critical hits
    if (isCritical) {
      // Add 3-5 particles for critical hits
      const particleCount = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < particleCount; i++) {
        // Add some random offset to each particle
        const offsetX = Math.random() * 40 - 20;
        const offsetY = Math.random() * 20 - 10;

        setClickAnimations((prev) => [
          ...prev,
          {
            id: nextAnimationId + i,
            value: i === 0 ? clickValue : Math.floor(clickValue / particleCount),
            x: x + offsetX,
            y: y + offsetY,
          },
        ]);
      }
      setNextAnimationId((prev) => prev + particleCount);
    } else {
      // Just one animation for normal clicks
      setClickAnimations((prev) => [
        ...prev,
        { id: nextAnimationId, value: clickValue, x, y },
      ]);
      setNextAnimationId((prev) => prev + 1);
    }
  };

  const buyMultiplier = () => {
    // Make multiplier cost grow exponentially
    const cost = Math.floor(multiplier * 100 * Math.pow(1.2, multiplier));
    if (count >= cost) {
      setCount(count - cost);
      setMultiplier(multiplier + 1);
    }
  };

  const buyAutoClicker = () => {
    // Make auto-clicker cost grow faster
    const cost = Math.floor((autoClickerCount + 1) * 50 * Math.pow(1.3, autoClickerCount));
    if (count >= cost) {
      setCount(count - cost);
      setAutoClickerCount(autoClickerCount + 1);
    }
  };

  const upgradeAutoClickerFrequency = () => {
    // Make clicker speed cost grow much faster (quadratic growth)
    const cost = Math.floor(autoClickerFrequency * 200 * Math.pow(2, autoClickerFrequency));
    if (count >= cost) {
      setCount(count - cost);
      setAutoClickerFrequency((prev) => prev + 0.5);
    }
  };

  const upgradeCriticalChance = () => {
    // Make critical chance cost grow faster
    const cost = Math.floor(
      criticalChance * 10000 * Math.pow(1.5, criticalChance * 10)
    );
    if (count >= cost) {
      setCount(count - cost);
      setCriticalChance((prev) => Math.min(prev + 0.05, 0.5)); // Cap at 50%
    }
  };

  const upgradeCriticalMultiplier = () => {
    // Make critical multiplier cost grow faster
    const cost = Math.floor(
      criticalMultiplier * 300 * Math.pow(1.4, criticalMultiplier - 5)
    );
    if (count >= cost) {
      setCount(count - cost);
      setCriticalMultiplier((prev) => prev + 1);
    }
  };

  // Calculate prestige cost based on current prestige level
  const getPrestigeCost = (currentPrestige: number): number => {
    // Base cost is 1 million, then 10x for each level
    return 1000000 * Math.pow(10, currentPrestige);
  };

  const performPrestige = () => {
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
  };

  const resetGame = () => {
    setCount(0);
    setMultiplier(1);
    setAutoClickerCount(0);
    setAutoClickerFrequency(1);
    setCriticalChance(0.05);
    setCriticalMultiplier(5);
    setPrestige(0);
  };

  const handleReset = async () => {
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

  // Function to generate a verification token
  const generateVerificationToken = (timestamp: number, score: number): string => {
    // Create token data using timestamp and score
    const tokenData = `${timestamp}:${score}`;
    console.log('Generated token data:', tokenData);
    return tokenData;
  };

  // Hash using crypto-js
  function hashString(str: string): string {
    console.log('Client hashing string:', str);
    const hash = crypto.SHA256(str).toString();
    console.log('Client generated hash:', hash);
    return hash;
  }

  const handleSaveScore = async () => {
    if (!playerName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter your name to save your score.',
        variant: 'destructive',
      });
      return;
    }

    // Check if score is too large to be safely handled by JavaScript
    const MAX_SAFE_SCORE = Number.MAX_SAFE_INTEGER; // 9007199254740991
    if (count > MAX_SAFE_SCORE) {
      toast({
        title: 'Score too large',
        description: `Your score (${formatCount(count)}) exceeds the maximum allowed value. The score will be capped at ${formatCount(MAX_SAFE_SCORE)}.`,
        variant: 'destructive',
      });
      // Cap the score at MAX_SAFE_SCORE
      const cappedScore = MAX_SAFE_SCORE;
      
      const prestigeLevel = Math.min(prestige, PRESTIGE_LEVELS.length - 1);
      const prestigeColor = PRESTIGE_LEVELS[prestigeLevel].color.replace('text-', '');

      // Generate current timestamp
      const timestamp = Date.now();

      // Generate a token that includes the capped score
      const tokenData = generateVerificationToken(timestamp, cappedScore);

      // Hash the token data
      const token = hashString(tokenData);

      // Create the submission data with verification and capped score
      const submissionData = {
        name: playerName,
        score: cappedScore,
        prestige: prestige,
        color: prestigeColor,
        timestamp: timestamp,
        token: token,
      };

      try {
        await saveScoreMutation.mutateAsync(submissionData);
        // Reset game state only after successful save
        resetGame();
      } catch (error) {
        // saveScoreMutation handles the error toast
        console.error('Error during save:', error);
      }
      return;
    }

    const prestigeLevel = Math.min(prestige, PRESTIGE_LEVELS.length - 1);
    const prestigeColor = PRESTIGE_LEVELS[prestigeLevel].color.replace('text-', '');

    // Generate current timestamp
    const timestamp = Date.now();

    // Generate a token that includes the score
    const tokenData = generateVerificationToken(timestamp, count);

    // Hash the token data
    const token = hashString(tokenData);

    // Create the submission data with verification
    const submissionData = {
      name: playerName,
      score: count,
      prestige: prestige,
      color: prestigeColor,
      timestamp: timestamp,
      token: token,
    };

    try {
      await saveScoreMutation.mutateAsync(submissionData);

      // Reset game state only after successful save
      resetGame();
    } catch (error) {
      // saveScoreMutation handles the error toast
      console.error('Error during save:', error);
    }
  };

  const formatCount = (num: number | null | undefined): string => {
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
  };

  // Get current prestige level info
  const currentPrestigeLevel = Math.min(prestige, PRESTIGE_LEVELS.length - 1);
  const prestigeColor = PRESTIGE_LEVELS[currentPrestigeLevel].color;
  const prestigeName = PRESTIGE_LEVELS[currentPrestigeLevel].name;

  // Helper function to get the appropriate CSS class for a score's color
  const getScoreColorClass = (scoreColor?: string): string => {
    if (!scoreColor) return '';

    // Handle the theme-adaptive color
    if (scoreColor === 'theme-adaptive') {
      return 'text-foreground';
    }

    return `text-${scoreColor}`;
  };

  const critChanceCost = Math.floor(
    criticalChance * 10000 * Math.pow(1.5, criticalChance * 10)
  );
  const critChanceAlmostMaxed = criticalChance >= 0.45;
  const critChanceMaxed = criticalChance >= 0.5;

  return (
    <>
      {/* Click animations container - positioned fixed relative to viewport with highest z-index */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 10000 }}
      >
        {clickAnimations.map((anim) => (
          <ClickAnimation key={anim.id} value={anim.value} x={anim.x} y={anim.y} />
        ))}
      </div>

      <Window
        title="clicker - season 2"
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
              <div className="text-center relative">
                <div className="absolute top-0 right-0">
                  {prestige > 0 && (
                    <div className={`flex items-center gap-1 ${prestigeColor}`}>
                      <Crown className="w-4 h-4" />
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
                <Sparkles className="w-6 h-6" />
                Click! (+{multiplier})
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`cs-button ${
                    count < Math.floor(multiplier * 100 * Math.pow(1.2, multiplier))
                      ? 'opacity-50'
                      : ''
                  }`}
                  onClick={buyMultiplier}
                  disabled={
                    count < Math.floor(multiplier * 100 * Math.pow(1.2, multiplier))
                  }
                >
                  <div className="flex items-center gap-1">
                    <ArrowUp className="w-4 h-4" />
                    <span>Multiplier</span>
                  </div>
                  <span className="block text-sm">
                    {formatCount(Math.floor(multiplier * 100 * Math.pow(1.2, multiplier)))}
                  </span>
                </button>

                <button
                  className={`cs-button ${
                    count <
                    Math.floor((autoClickerCount + 1) * 50 * Math.pow(1.3, autoClickerCount))
                      ? 'opacity-50'
                      : ''
                  }`}
                  onClick={buyAutoClicker}
                  disabled={
                    count <
                    Math.floor((autoClickerCount + 1) * 50 * Math.pow(1.3, autoClickerCount))
                  }
                >
                  <div className="flex items-center gap-1">
                    <Zap className="w-4 h-4" />
                    <span>Auto-clicker</span>
                  </div>
                  <span className="block text-sm">
                    {formatCount(
                      Math.floor((autoClickerCount + 1) * 50 * Math.pow(1.3, autoClickerCount))
                    )}
                  </span>
                </button>

                <button
                  className={`cs-button ${
                    count <
                    Math.floor(autoClickerFrequency * 200 * Math.pow(2, autoClickerFrequency))
                      ? 'opacity-50'
                      : ''
                  }`}
                  onClick={upgradeAutoClickerFrequency}
                  disabled={
                    count <
                      Math.floor(autoClickerFrequency * 200 * Math.pow(2, autoClickerFrequency)) ||
                    autoClickerCount === 0
                  }
                >
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>Auto CPS</span>
                  </div>
                  <span className="block text-sm">
                    {formatCount(
                      Math.floor(autoClickerFrequency * 200 * Math.pow(2, autoClickerFrequency))
                    )}
                  </span>
                </button>

                <button
                  className={`cs-button ${
                    count < critChanceCost || critChanceMaxed ? 'opacity-50' : ''
                  }`}
                  onClick={upgradeCriticalChance}
                  disabled={count < critChanceCost || critChanceMaxed}
                >
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-4 h-4" />
                    <span>Crit Chance</span>
                  </div>
                  <span className="block text-sm">
                    {critChanceAlmostMaxed
                      ? 'Sold Out'
                      : formatCount(critChanceCost)}
                  </span>
                </button>

                <button
                  className={`cs-button ${
                    count <
                    Math.floor(
                      criticalMultiplier * 300 * Math.pow(1.4, criticalMultiplier - 5)
                    )
                      ? 'opacity-50'
                      : ''
                  }`}
                  onClick={upgradeCriticalMultiplier}
                  disabled={
                    count <
                    Math.floor(
                      criticalMultiplier * 300 * Math.pow(1.4, criticalMultiplier - 5)
                    )
                  }
                >
                  <div className="flex items-center gap-1">
                    <Zap className="w-4 h-4" />
                    <span>Crit Damage</span>
                  </div>
                  <span className="block text-sm">
                    {formatCount(
                      Math.floor(criticalMultiplier * 300 * Math.pow(1.4, criticalMultiplier - 5))
                    )}
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
                <RotateCcw className="w-4 h-4" />
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
              <p className={`text-lg ${prestigeColor}`}>
                {prestige > 0 && <Crown className="w-4 h-4 inline mr-1" />}
                Your Score: {formatCount(count)}
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
    </>
  );
}
