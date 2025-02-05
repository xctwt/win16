// components/DrawingsViewer.tsx
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Window } from './Windows';
import { Drawing } from '@shared/schema';
import { RefreshCw } from 'lucide-react'; // Import the refresh icon

export function DrawingsViewer() {
  const queryClient = useQueryClient();
  const { data: drawings = [], isLoading } = useQuery<Drawing[]>({
    queryKey: ['/api/drawings'],
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/drawings'] });
  };

  return (
    <Window title="drawings" windowId="drawings" defaultPosition={{ x: 500, y: 100 }}>
      <div className="w-80 space-y-2">
        {/* Header with refresh button */}
        <div className="flex justify-between items-center px-2">
          <span className="text-sm opacity-70">
            {drawings.length} drawing{drawings.length !== 1 ? 's' : ''}
          </span>
          <button 
            className={`cs-button p-1 ${isLoading ? 'animate-spin' : ''}`}
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Drawings grid */}
        <div className="h-80 overflow-auto grid grid-cols-2 gap-2 p-2">
          {drawings.map((drawing) => (
            <div key={drawing.id} className="border border-cs-border p-1">
              <img
                src={drawing.imageData}
                alt={`Drawing ${drawing.id}`}
                className="w-full h-auto"
                loading="lazy"
              />
              <div className="text-xs space-y-1 mt-1">
                <div className="font-bold">{drawing.name}</div>
                <div>by {drawing.author}</div>
                <div>{new Date(drawing.timestamp).toLocaleString()}</div>
              </div>
            </div>
          ))}

          {/* Empty state */}
          {drawings.length === 0 && !isLoading && (
            <div className="col-span-2 text-center text-sm opacity-70 py-8">
              No drawings yet
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="col-span-2 text-center text-sm opacity-70 py-8">
              Loading...
            </div>
          )}
        </div>
      </div>
    </Window>
  );
}
