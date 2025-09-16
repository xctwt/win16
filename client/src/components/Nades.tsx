import React, { useState, useMemo } from 'react';
import { Window } from './Windows';
import { X, ArrowLeft } from 'lucide-react';

// Data model
interface NadeInfo {
  id: string;
  name: string;
  type: 'smoke' | 'flash' | 'molotov' | 'he';
  side: 't' | 'ct';
  map: string;
  spawn: string; // spawn location id
  description?: string;
  lineUp?: string;
  video?: string; // external video link
  gif?: string;   // short gif/placeholder
  detail?: string; // longer description
}

// Spawn point meta per map (placeholder coords in %). Extend as needed.
interface SpawnPoint { id: string; label: string; x: number; y: number; }
const SPAWN_POINTS: Record<string, SpawnPoint[]> = {
  mirage: [
    { id: 'front-left', label: 'Front L', x: 22, y: 38 },
    { id: 'front-right', label: 'Front R', x: 45, y: 35 },
    { id: 'back-left', label: 'Back L', x: 15, y: 55 },
    { id: 'back-right', label: 'Back R', x: 40, y: 57 },
    { id: 'mid', label: 'Mid', x: 30, y: 48 },
  ],
  dust2: [
    { id: 'front-left', label: 'Front L', x: 60, y: 30 },
    { id: 'front-right', label: 'Front R', x: 75, y: 32 },
    { id: 'back-left', label: 'Back L', x: 55, y: 50 },
    { id: 'back-right', label: 'Back R', x: 73, y: 52 },
    { id: 'spawn-mid', label: 'Mid', x: 67, y: 42 },
  ],
  ancient: [],
  inferno: [],
  nuke: [],
  anubis: [],
  vertigo: [],
  overpass: [],
};

// Placeholder dataset
const NADE_DATA: NadeInfo[] = [
  {
    id: 'mirage_t_smoke_window_1', name: 'Window Smoke', type: 'smoke', side: 't', map: 'mirage', spawn: 'front-left',
    description: 'Classic mid control smoke from T spawn', lineUp: 'Align with the middle of the antenna and jump-throw', gif: '',
    detail: 'Ensures AWPer in window must reposition. Throw at round start for safe mid take.'
  },
  {
    id: 'mirage_t_smoke_cat_1', name: 'Cat Smoke', type: 'smoke', side: 't', map: 'mirage', spawn: 'back-right',
    description: 'Blocks early cat peek', lineUp: 'Stand at the trash can, aim top of building and jump-throw', gif: '',
    detail: 'Gives space for short lurk or boosts mid presence without cat pressure.'
  },
  {
    id: 'mirage_ct_flash_mid', name: 'Mid Pop Flash', type: 'flash', side: 'ct', map: 'mirage', spawn: 'mid',
    description: 'Fast info flash for mid swing', lineUp: 'From window, left-click throw off the top frame', gif: '',
    detail: 'Turns T mid players. Coordinate with connector swing for maximum value.'
  },
  {
    id: 'dust2_t_flash_long', name: 'Long Pop', type: 'flash', side: 't', map: 'dust2', spawn: 'front-right',
    description: 'Instant long door pop', lineUp: 'Hug the blue, aim above door frame, left click', gif: '',
    detail: 'Blinds most CTs contesting long corner. Chain with second flash for guarantee.'
  },
  {
    id: 'dust2_ct_smoke_cross', name: 'Cross Smoke', type: 'smoke', side: 'ct', map: 'dust2', spawn: 'spawn-mid',
    description: 'Retake A cross block', lineUp: 'Line with the crack, aim at the wire and jump-throw', gif: '',
    detail: 'Used mainly for retakes or fake presence at long when rotating.'
  },
];

const MAPS = ['mirage', 'dust2', 'ancient', 'inferno', 'nuke', 'anubis', 'vertigo', 'overpass'];
const SIDES: Array<{ value: 't' | 'ct'; label: string }> = [
  { value: 't', label: 'T' },
  { value: 'ct', label: 'CT' }
];
const TYPES: Array<{ value: 'all' | 'smoke' | 'flash' | 'molotov' | 'he'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'smoke', label: 'Smoke' },
  { value: 'flash', label: 'Flash' },
  { value: 'molotov', label: 'Molotov' },
  { value: 'he', label: 'HE' },
];

export function Nades() {
  const [selectedMap, setSelectedMap] = useState<string>('mirage');
  const [selectedSide, setSelectedSide] = useState<'t' | 'ct'>('t');
  const [typeFilter, setTypeFilter] = useState<'all' | 'smoke' | 'flash' | 'molotov' | 'he'>('all');
  const [selectedSpawn, setSelectedSpawn] = useState<string>('front-left');
  const [detail, setDetail] = useState<NadeInfo | null>(null);
  const [search, setSearch] = useState('');

  const defaultPosition = useMemo(() => ({ x: 300, y: 60 }), []);

  const spawns = SPAWN_POINTS[selectedMap] ?? [];

  const nades = useMemo(() => NADE_DATA.filter(n =>
    n.map === selectedMap &&
    n.side === selectedSide &&
    (typeFilter === 'all' || n.type === typeFilter) &&
    (selectedSpawn ? n.spawn === selectedSpawn : true) &&
    (search.trim() === '' || n.name.toLowerCase().includes(search.toLowerCase()))
  ), [selectedMap, selectedSide, typeFilter, selectedSpawn, search]);

  // Updated style helpers
  const selectClass = 'cs-select appearance-none bg-black/40 bg-white/95 text-black border border-cs-border px-2 py-1 pr-6 text-xs outline-none focus:border-cs-accent hover:border-cs-accent transition-colors rounded-sm';
  const markerBase = 'spawn-marker absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-[9px] cursor-pointer border transition-colors font-medium';

  const renderDetail = () => detail && (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{detail.name}</h3>
        <button onClick={() => setDetail(null)} className="px-2 py-1 border border-cs-border hover:border-cs-accent transition-colors text-xs flex items-center gap-1">
          <ArrowLeft size={12}/> back
        </button>
      </div>
      <div className="text-[11px] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
        <div className="flex gap-2 flex-wrap text-[10px] uppercase tracking-wide">
          <span className="px-1 py-[1px] border border-cs-border">{detail.map}</span>
          <span className="px-1 py-[1px] border border-cs-border">{detail.side}</span>
          <span className="px-1 py-[1px] border border-cs-border">{detail.type}</span>
          <span className="px-1 py-[1px] border border-cs-border">spawn: {detail.spawn}</span>
        </div>
        {detail.description && <p className="leading-snug opacity-80">{detail.description}</p>}
        {detail.lineUp && <p className="leading-snug opacity-70">Lineup: {detail.lineUp}</p>}
        {detail.detail && <p className="leading-snug opacity-90">{detail.detail}</p>}
        {detail.video && (
          <a href={detail.video} target="_blank" rel="noreferrer" className="underline text-blue-300 text-[11px]">video link</a>
        )}
        <div className="border border-dashed border-cs-border p-4 h-48 flex items-center justify-center text-[10px] opacity-60">
          gif / image placeholder
        </div>
      </div>
    </div>
  );

  return (
    <Window title={detail ? detail.name : 'nades'} windowId="nades" defaultPosition={defaultPosition}>
      <div className="w-[800px] h-[450px] max-w-[97vw] flex flex-col text-xs">
        {detail ? (
          renderDetail()
        ) : (
          <>
            <style>{`
              /* Selects */
              .cs-select { color: #eee; background: rgba(0,0,0,0.4); }
              html.light .cs-select { color: #111; background: #ffffff !important; }
              .cs-select option { background: #111; color: #eee; }
              html.light .cs-select option { background: #fff; color: #111; }
              /* Lineup list items */
              .nade-item { background: rgba(0,0,0,0.2); }
              .nade-item:hover { background: rgba(0,0,0,0.3); }
              html.light .nade-item { background:#ffffff; }
              html.light .nade-item:hover { background:#ffffff; filter:brightness(0.96); }
              /* Ensure border color stays consistent in light theme */
              html.light .nade-item { border-color: #d0d0d0; }
              /* Spawn markers */
              .spawn-marker { color:#fff; }
              .spawn-marker.selected { color:#fff; box-shadow:0 0 0 1px rgba(0,0,0,0.5),0 0 4px rgba(0,0,0,0.4); }
              html.light .spawn-marker.selected { color:#111; box-shadow:0 0 0 1px rgba(0,0,0,0.25); }
            `}</style>
            <div className="flex flex-wrap gap-2 items-center mb-3">
              <div className="relative">
                <select value={selectedMap} onChange={e => { setSelectedMap(e.target.value); setSelectedSpawn(''); }} className={selectClass + ' w-28'}>
                  {MAPS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-60">▼</span>
              </div>
              <div className="relative">
                <select value={selectedSide} onChange={e => { setSelectedSide(e.target.value as any); }} className={selectClass + ' w-20'}>
                  {SIDES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-60">▼</span>
              </div>
              <div className="relative">
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className={selectClass + ' w-28'}>
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-60">▼</span>
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="search" className={selectClass + ' w-40'} />
            </div>
            <div className="flex gap-4 flex-1 min-h-0">
              {/* Spawn map (reduced size) */}
              <div className="w-[420px] flex flex-col gap-2">
                <div className="text-[10px] opacity-70 flex justify-between"><span>Click a spawn point</span><span className="opacity-40">{selectedSpawn || 'none'}</span></div>
                <div className="relative border border-cs-border bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent)] h-[240px] overflow-hidden rounded-sm">
                  <div className="absolute inset-x-0 top-1 text-center text-[10px] tracking-wide uppercase opacity-40 pointer-events-none">{selectedMap} spawn (placeholder)</div>
                  {spawns.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] opacity-50 p-4 text-center">
                      No spawn layout defined yet.
                    </div>
                  )}
                  {spawns.map(sp => {
                    const selected = sp.id === selectedSpawn;
                    return (
                      <button
                        key={sp.id}
                        style={{ left: sp.x + '%', top: sp.y + '%' }}
                        onClick={() => setSelectedSpawn(sp.id)}
                        className={markerBase + ' ' + (selected ? 'selected bg-cs-accent border-cs-border' : 'bg-black/50 hover:bg-cs-accent/40 border-cs-border')}
                        title={sp.label}
                      >
                        {sp.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Nade list */}
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="text-[10px] opacity-70 mb-1 flex items-center justify-between">
                  <span>Lineups</span>
                  <span className="opacity-40">{nades.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                  {nades.map(n => (
                    <button
                      key={n.id}
                      onClick={() => setDetail(n)}
                      className="nade-item group w-full text-left border border-cs-border hover:border-cs-accent transition-colors p-2 flex gap-3 items-stretch rounded-sm"
                    >
                      <div className="w-28 h-16 border border-cs-border flex items-center justify-center text-[10px] dark:bg-black/30 bg-white rounded-[2px] overflow-hidden">
                        {n.gif ? (
                          <img src={n.gif} alt={n.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="opacity-50">gif</span>
                        )}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium truncate pr-2 group-hover:text-cs-accent transition-colors">{n.name}</span>
                          <span className="text-[9px] uppercase tracking-wide px-1 py-[2px] border border-cs-border rounded-sm">{n.type}</span>
                        </div>
                        {n.lineUp && <p className="text-[10px] leading-snug opacity-70 line-clamp-2">{n.lineUp}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Window>
  );
}
