import { useState, useEffect, useRef } from 'react';
import { Window } from './Windows';
import { Sparkles, Trophy, RotateCcw, Crown, Clock, Zap, ArrowUp } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

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
      setPosX(prev => prev + (Math.random() * 3 - 1.5));
      setScale(prev => prev + 0.03); // Grow slightly as it rises
    }, 30);
    
    return () => clearInterval(timer);
  }, []);
  
  if (opacity <= 0) return null;
  
  const isCritical = value > 10;
  
  return (
    <div 
      className={`fixed pointer-events-none font-bold ${isCritical ? 'text-yellow-400 dark:text-yellow-400' : 'text-foreground'}`}
      style={{ 
        left: posX, 
        top: posY, 
        opacity, 
        transform: `scale(${isCritical ? 1.5 * scale : scale})`,
        zIndex: 10000,
        textShadow: isCritical ? '0 0 8px rgba(255, 215, 0, 0.8)' : '0 0 4px rgba(128, 128, 128, 0.5)',
        fontSize: '16px'
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
  const [clickAnimations, setClickAnimations] = useState<Array<{id: number, value: number, x: number, y: number}>>([]);
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
    }
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
        token: data.token ? data.token.substring(0, 10) + '...' : undefined
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
        description: error.message || 'Failed to save your score. Please try again.',
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
        setClickAnimations(prev => prev.slice(1));
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
        const offsetX = (Math.random() * 40) - 20;
        const offsetY = (Math.random() * 20) - 10;
        
        setClickAnimations(prev => [
          ...prev, 
          { 
            id: nextAnimationId + i, 
            value: i === 0 ? clickValue : Math.floor(clickValue / particleCount), 
            x: x + offsetX, 
            y: y + offsetY 
          }
        ]);
      }
      setNextAnimationId(prev => prev + particleCount);
    } else {
      // Just one animation for normal clicks
      setClickAnimations(prev => [
        ...prev, 
        { id: nextAnimationId, value: clickValue, x, y }
      ]);
      setNextAnimationId(prev => prev + 1);
    }
  };

  const buyMultiplier = () => {
    // Restore normal cost
    const cost = multiplier * 100;
    if (count >= cost) {
      setCount(count - cost);
      setMultiplier(multiplier + 1);
    }
  };

  const buyAutoClicker = () => {
    // Restore normal cost
    const cost = (autoClickerCount + 1) * 50;
    if (count >= cost) {
      setCount(count - cost);
      setAutoClickerCount(autoClickerCount + 1);
    }
  };
  
  const upgradeAutoClickerFrequency = () => {
    // Restore normal cost
    const cost = autoClickerFrequency * 200;
    if (count >= cost) {
      setCount(count - cost);
      setAutoClickerFrequency(prev => prev + 0.5);
    }
  };
  
  const upgradeCriticalChance = () => {
    // Restore normal cost
    const cost = Math.floor(criticalChance * 10000);
    if (count >= cost) {
      setCount(count - cost);
      setCriticalChance(prev => Math.min(prev + 0.05, 0.5)); // Cap at 50%
    }
  };
  
  const upgradeCriticalMultiplier = () => {
    // Restore normal cost
    const cost = criticalMultiplier * 300;
    if (count >= cost) {
      setCount(count - cost);
      setCriticalMultiplier(prev => prev + 1);
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
        description: `You need at least ${formatCount(prestigeCost)} points to prestige.`,
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
    setCriticalChance(0.05 + (newPrestige * 0.01)); // Prestige bonus
    setCriticalMultiplier(5 + newPrestige); // Prestige bonus
    
    toast({
      title: 'Prestige Level Up!',
      description: `You are now ${PRESTIGE_LEVELS[Math.min(newPrestige, PRESTIGE_LEVELS.length - 1)].name} prestige!`,
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

  // Function to generate a verification token
  const generateVerificationToken = (timestamp: number, score: number): string => {
    // Create token data using timestamp and score
    const tokenData = `${timestamp}:${score}`;
    console.log('Generated token data:', tokenData);
    return tokenData;
  };

  // Simple hash function for demonstration
  function hashString(str: string): string {
    console.log('Client hashing string:', str);
    
    // This is a very simple hash function for demonstration
    // In a real app, use a proper crypto library like crypto-js
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    // Convert to hex string and pad to ensure it's long enough
    const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
    
    // Repeat the hash to make it look more like a real hash
    const finalHash = hexHash.repeat(8);
    console.log('Client generated hash:', finalHash);
    
    return finalHash;
  }

  const handleSaveScore = () => {
    if (!playerName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter your name to save your score.',
        variant: 'destructive',
      });
      return;
    }
    
    const prestigeLevel = Math.min(prestige, PRESTIGE_LEVELS.length - 1);
    const prestigeColor = PRESTIGE_LEVELS[prestigeLevel].color.replace('text-', '');
    
    // Generate current timestamp
    const timestamp = Date.now();
    
    // Generate a token that includes the score
    // This ensures the score can't be changed without invalidating the token
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
      token: token
    };
    
    console.log('Submitting score with verification:', {
      ...submissionData,
      token: submissionData.token,
      tokenData: tokenData // Log the raw token data for debugging
    });
    
    saveScoreMutation.mutate(submissionData);
  };

  const formatCount = (num: number): string => {
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

  return (
    <>
      {/* Click animations container - positioned fixed relative to viewport with highest z-index */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 10000 }}>
        {clickAnimations.map(anim => (
          <ClickAnimation 
            key={anim.id} 
            value={anim.value} 
            x={anim.x} 
            y={anim.y} 
          />
        ))}
      </div>
      
      <Window
        title="clicker - season 2"
        windowId="clicker"
        defaultPosition={{ x: 300, y: 200 }}
      >
        <div className="space-y-4 p-4" style={{ width: '320px' }}>
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
                  Multiplier: x{multiplier} | Auto-clickers: {autoClickerCount} ({autoClickerFrequency}/s)
                </p>
                <p className="text-xs text-gray-400">
                  Critical: {Math.round(criticalChance * 100)}% chance for x{criticalMultiplier}
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
                    count < multiplier * 100 ? 'opacity-50' : ''
                  }`}
                  onClick={buyMultiplier}
                  disabled={count < multiplier * 100}
                >
                  <div className="flex items-center gap-1">
                    <ArrowUp className="w-4 h-4" />
                    <span>Multiplier</span>
                  </div>
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
                  <div className="flex items-center gap-1">
                    <Zap className="w-4 h-4" />
                    <span>Auto-clicker</span>
                  </div>
                  <span className="block text-sm">
                    Cost: {formatCount((autoClickerCount + 1) * 50)}
                  </span>
                </button>
                
                <button
                  className={`cs-button ${
                    count < autoClickerFrequency * 200 ? 'opacity-50' : ''
                  }`}
                  onClick={upgradeAutoClickerFrequency}
                  disabled={count < autoClickerFrequency * 200 || autoClickerCount === 0}
                >
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>Clicker Speed</span>
                  </div>
                  <span className="block text-sm">
                    Cost: {formatCount(autoClickerFrequency * 200)}
                  </span>
                </button>
                
                <button
                  className={`cs-button ${
                    count < Math.floor(criticalChance * 10000) ? 'opacity-50' : ''
                  }`}
                  onClick={upgradeCriticalChance}
                  disabled={count < Math.floor(criticalChance * 10000) || criticalChance >= 0.5}
                >
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-4 h-4" />
                    <span>Crit Chance</span>
                  </div>
                  <span className="block text-sm">
                    Cost: {formatCount(Math.floor(criticalChance * 10000))}
                  </span>
                </button>
                
                <button
                  className={`cs-button ${
                    count < criticalMultiplier * 300 ? 'opacity-50' : ''
                  }`}
                  onClick={upgradeCriticalMultiplier}
                  disabled={count < criticalMultiplier * 300}
                >
                  <div className="flex items-center gap-1">
                    <Zap className="w-4 h-4" />
                    <span>Crit Damage</span>
                  </div>
                  <span className="block text-sm">
                    Cost: {formatCount(criticalMultiplier * 300)}
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
                  <span className="block text-sm">
                    Requires: {formatCount(getPrestigeCost(prestige))}
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
            <>
              <div className="mb-4">
                <Select
                  value={selectedSeason}
                  onValueChange={setSelectedSeason}
                >
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
                          {score.prestige && score.prestige > 0 && (
                            <Crown className="w-3 h-3 inline mr-1" />
                          )}
                          {score.name}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`font-bold ${getScoreColorClass(score.color)}`}>
                          {formatCount(score.score)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(score.date).toLocaleDateString()}
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
                {prestige > 0 && (
                  <Crown className="w-4 h-4 inline mr-1" />
                )}
                Your Score: {formatCount(count)}
              </p>
              {prestige > 0 && (
                <p className={`text-sm ${prestigeColor}`}>
                  Prestige Level: {prestigeName}
                </p>
              )}
              <div className="mt-2 text-xs text-gray-400 flex items-center justify-center gap-2">
                <span>Verification: Ready</span>
              </div>
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
