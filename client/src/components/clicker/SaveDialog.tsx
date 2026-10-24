import { useState } from "react";
import { prestigeLevel } from "@shared/clicker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCount, prestigeClass } from "./format";

export function SaveDialog({
  open,
  onOpenChange,
  score,
  prestige,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  score: number;
  prestige: number;
  /** Resolves when the score is saved; rejects with a message to show. */
  onSave: (name: string) => Promise<void>;
}) {
  const [playerName, setPlayerName] = useState("");
  const [saving, setSaving] = useState(false);
  const color = prestigeClass(prestige);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(playerName.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              maxLength={50}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>
          <div className="space-y-2">
            <p className={`text-lg ${color}`}>Score: {formatCount(score)}</p>
            {prestige > 0 && <p className={`text-sm ${color}`}>Prestige Level: {prestigeLevel(prestige).name}</p>}
          </div>
        </div>
        <DialogFooter>
          <button className="cs-button" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Score"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
