import { memo, useState, type MouseEvent, type ReactNode } from "react";
import { ArrowUp, Clock, Crown, RotateCcw, Sparkles, Zap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  canBuy,
  finalScore,
  prestigeCost,
  prestigeLevel,
  upgradeCost,
  type ClickerState,
  type Upgrade,
} from "@shared/clicker";
import { useToast } from "@/hooks/use-toast";
import { Window } from "../Windows";
import { useClickAnimations } from "./ClickAnimations";
import { Leaderboard } from "./Leaderboard";
import { SaveDialog } from "./SaveDialog";
import { formatCount, prestigeClass } from "./format";
import { useClickerGame } from "./useClickerGame";

type Tab = "game" | "scores";

const DEFAULT_POSITION = { x: 75, y: 130 };

const UPGRADE_BUTTONS: { upgrade: Upgrade; label: string; icon: ReactNode }[] = [
  { upgrade: "multiplier", label: "Multiplier", icon: <ArrowUp className="w-4 h-4" /> },
  { upgrade: "autoClicker", label: "Auto-clicker", icon: <Zap className="w-4 h-4" /> },
  { upgrade: "autoSpeed", label: "Auto CPS", icon: <Clock className="w-4 h-4" /> },
  { upgrade: "critChance", label: "Crit Chance", icon: <Sparkles className="w-4 h-4" /> },
  { upgrade: "critDamage", label: "Crit Damage", icon: <Zap className="w-4 h-4" /> },
];

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      className={`cs-button flex-1 ${active ? "border-(--cs-text)" : "border-(--cs-border)"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ShopButton({
  enabled,
  onClick,
  icon,
  label,
  price,
}: {
  enabled: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  price: string;
}) {
  return (
    <button className={`cs-button ${enabled ? "" : "opacity-50"}`} onClick={onClick} disabled={!enabled}>
      <div className="flex items-center gap-1">
        {icon}
        <span>{label}</span>
      </div>
      <span className="block text-sm">{price}</span>
    </button>
  );
}

function Game({
  state,
  act,
  onReset,
}: {
  state: ClickerState;
  act: ReturnType<typeof useClickerGame>["act"];
  onReset: () => void;
}) {
  const { toast } = useToast();
  const { layer, spawn } = useClickAnimations();
  const color = prestigeClass(state.prestige);

  const click = (e: MouseEvent<HTMLButtonElement>) => {
    const result = act("click");
    if (!result?.click) return;
    // Keyboard "clicks" have no pointer position; use the button's centre.
    let { clientX: x, clientY: y } = e;
    if (!e.detail) {
      const rect = e.currentTarget.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }
    spawn(x, y, result.click.value, result.click.critical, state.multiplier);
  };

  const prestige = () => {
    const cost = prestigeCost(state);
    if (!act("prestige")) {
      toast({
        title: "Not enough points",
        description: `You need at least ${formatCount(cost)} points to prestige.`,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Prestige Level Up!",
      description: `You are now ${prestigeLevel(state.prestige + 1).name} prestige!`,
    });
  };

  return (
    <>
      {layer}
      <div className="text-center relative">
        <div className="absolute top-0 right-0">
          {state.prestige > 0 && (
            <div className={`flex items-center gap-1 ${color}`}>
              <Crown className="w-4 h-4 inline mr-1" />
              <span>{prestigeLevel(state.prestige).name}</span>
            </div>
          )}
        </div>
        <h2 className={`text-2xl font-bold ${color}`}>{formatCount(state.count)}</h2>
        <p className="text-sm text-gray-400">
          Multiplier: x{state.multiplier} | Auto-clickers: {state.autoClickers} ({state.autoSpeed.toFixed(1)}/s)
        </p>
        <p className="text-xs text-gray-400">
          Critical: {Math.round(state.critChance * 100)}% chance for x{state.critDamage}
        </p>
      </div>

      <button
        className="cs-button w-full h-24 text-xl flex items-center justify-center gap-2 relative overflow-hidden transition-transform active:scale-95"
        onClick={click}
      >
        <Sparkles className="w-6 h-6" />
        Click! (+{state.multiplier})
      </button>

      <div className="grid grid-cols-2 gap-2">
        {UPGRADE_BUTTONS.map(({ upgrade, label, icon }) => (
          <ShopButton
            key={upgrade}
            enabled={canBuy(state, upgrade)}
            onClick={() => act(upgrade)}
            icon={icon}
            label={label}
            price={
              upgrade === "critChance" && state.critChance >= 0.45
                ? "Sold Out"
                : formatCount(upgradeCost(state, upgrade))
            }
          />
        ))}
        <ShopButton
          enabled={state.count >= prestigeCost(state)}
          onClick={prestige}
          icon={<Crown className="w-4 h-4" />}
          label="Prestige"
          price={formatCount(prestigeCost(state))}
        />
      </div>

      <button className="cs-button w-full flex items-center justify-center gap-2" onClick={onReset}>
        <RotateCcw className="w-4 h-4" />
        Reset & Save Score
      </button>
    </>
  );
}

export const Clicker = memo(function Clicker() {
  const [activeTab, setActiveTab] = useState<Tab>("game");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const game = useClickerGame({
    onDesync: (message) => toast({ title: "Game synced", description: message, variant: "destructive" }),
  });
  const { state } = game;

  const gameResetToast = () =>
    toast({ title: "Game Reset", description: "Your game has been reset. Starting fresh!" });

  const handleReset = async () => {
    if (state && finalScore(state) > 0) {
      setShowSaveDialog(true);
      return;
    }
    toast({ title: "Nothing to save", description: "Score is 0. Game reset.", variant: "destructive" });
    try {
      await game.reset();
      gameResetToast();
    } catch (e) {
      toast({ title: "Couldn't reset the game", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleSave = async (name: string) => {
    if (!name) {
      toast({ title: "Name Required", description: "Please enter your name to save your score.", variant: "destructive" });
      return;
    }
    try {
      await game.save(name);
    } catch (e) {
      toast({
        title: "Error saving score",
        description: (e as Error).message || "Failed to save your score. Please try again.",
        variant: "destructive",
      });
      return;
    }
    setShowSaveDialog(false);
    toast({ title: "Score saved!", description: "Your score has been saved to the leaderboard." });
    queryClient.invalidateQueries({ queryKey: ["highScores"] });
    gameResetToast();
  };

  return (
    <Window title="clicker - season 2" windowId="clicker" defaultPosition={DEFAULT_POSITION}>
      <div className="space-y-4 p-4" style={{ width: "300px" }}>
        <div className="flex gap-2 mb-4">
          <TabButton active={activeTab === "game"} onClick={() => setActiveTab("game")}>
            Game
          </TabButton>
          <TabButton active={activeTab === "scores"} onClick={() => setActiveTab("scores")}>
            Leaderboard
          </TabButton>
        </div>

        {activeTab === "scores" ? (
          <Leaderboard />
        ) : state ? (
          <Game state={state} act={game.act} onReset={handleReset} />
        ) : game.loadError ? (
          <div className="text-center space-y-2">
            <p className="text-sm text-red-500">{game.loadError}</p>
            <button className="cs-button" onClick={game.retry}>
              Try again
            </button>
          </div>
        ) : (
          <p className="text-center text-sm opacity-70 py-8">Loading...</p>
        )}
      </div>

      {state && (
        <SaveDialog
          open={showSaveDialog}
          onOpenChange={setShowSaveDialog}
          score={finalScore(state)}
          prestige={state.prestige}
          onSave={handleSave}
        />
      )}
    </Window>
  );
});
