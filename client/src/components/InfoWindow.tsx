import { Window } from "./Windows";
import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

interface ChangelogEntry {
  date: string;
  changes: string[];
  isExpanded?: boolean;
}

const changelog: ChangelogEntry[] = [
  {
    date: '2025-09-16',
    changes: [
      'ws chat instead of query',
      'fixed vote counting',
      'new icons'
    ]
  },
  {
    date: '2025-08-26',
    changes: [
      'PoW voting system in drawings'
    ]
  },
  {
    date: '2024-03-10',
    changes: [
      "Added anonymous contact form with rich text editor",
      "Removed clicker debounce, fixed score uploading",
      "Added media controls to music player",
      "Added seekbar to music player",
      "Added changelog window",
    ],
  },
  {
    date: "2024-03-09",
    changes: [
      "Added new screensaver options",
      "A bunch of react optimizations",
    ],
  },
  {
    date: "2024-03-08",
    changes: [
      "Fixed null scores in clicker",
      "Added rgb color picker to paint tool",
    ],
  },
  {
    date: "2024-03-07",
    changes: [
      "Clicker S2: Crit hits, Steep price curve, Prestige levels with unique colors",
      "Added oneko cat follow mouse",
    ],
  },
];

export function InfoWindow() {
  const defaultPosition = useMemo(() => ({ x: 75, y: 105 }), []);
  const [expandedDates, setExpandedDates] = useState<string[]>([changelog[0].date]);

  const toggleExpand = (date: string) => {
    setExpandedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date],
    );
  };

  return (
    <Window title="readme" windowId="info" defaultPosition={defaultPosition}>
      <div className="w-64 space-y-4">
        <div className="text-sm">
          <p className="mb-2">
            inspired by{" "}
            <a href="https://hardanimeshirts.com">hardanimeshirts</a>
          </p>
          <p className="mb-2">/help in chat to see commands</p>
          <p>&lt;3</p>
        </div>

        <div className="border-t border-cs-border pt-4">
          <h3 className="text-sm font-medium mb-2">Changelog</h3>
          <div className="space-y-2">
            {changelog.map((entry) => (
              <div key={entry.date} className="text-xs">
                <button
                  className="flex items-center gap-1 w-full hover:text-blue-300 transition-colors"
                  onClick={() => toggleExpand(entry.date)}
                >
                  {expandedDates.includes(entry.date) ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                  <span className="font-medium">{entry.date}</span>
                </button>
                {expandedDates.includes(entry.date) && (
                  <ul className="ml-5 mt-1 space-y-1 list-disc">
                    {entry.changes.map((change, i) => (
                      <li key={i} className="text-cs-text opacity-80">
                        {change}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-cs-border pt-2">
          <p className="text-xs text-center">Made with HATE</p>
        </div>
      </div>
    </Window>
  );
}
