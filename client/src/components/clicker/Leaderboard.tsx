import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Score, SeasonsResponse } from "@shared/types";
import { formatCount, scoreColorClass } from "./format";

export function Leaderboard() {
  const [selectedSeason, setSelectedSeason] = useState("current");

  const { data: seasonsData = { seasons: [1, 2], currentSeason: 2 } } = useQuery<SeasonsResponse>({
    queryKey: ["seasons"],
    queryFn: async () => {
      const response = await fetch("/api/seasons");
      if (!response.ok) throw new Error("Failed to load seasons");
      return response.json();
    },
  });
  const season = selectedSeason === "current" ? String(seasonsData.currentSeason) : selectedSeason;

  // Already sorted by prestige, then score.
  const { data: highScores = [] } = useQuery<Score[]>({
    queryKey: ["highScores", season],
    queryFn: async () => {
      const response = await fetch(`/api/scores?season=${season}`);
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  return (
    <>
      <div className="mb-4">
        <Select value={season} onValueChange={setSelectedSeason}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select Season">{`Season ${season}`}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {seasonsData.seasons.map((s) => (
              <SelectItem key={s} value={s.toString()}>
                Season {s} {s === seasonsData.currentSeason ? "(Current)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {highScores.length > 0 ? (
          highScores.map((score, index) => (
            <div key={index} className="flex justify-between items-center border border-cs-border p-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="font-bold min-w-[32px]">#{index + 1}</span>
                <span className={`truncate ${scoreColorClass(score.color)}`}>
                  {score.prestige > 0 ? <Crown className="w-3 h-3 inline mr-1" /> : null}
                  {score.name}
                </span>
              </div>
              <div className="text-right shrink-0">
                <div className={`font-bold ${scoreColorClass(score.color)}`}>{formatCount(score.score)}</div>
                <div className="text-xs text-gray-400">
                  {score.date ? new Date(score.date).toLocaleDateString() : "Unknown date"}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center p-4 text-gray-400">No scores for this season yet</div>
        )}
      </div>
    </>
  );
}
