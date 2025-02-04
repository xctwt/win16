import { useQuery } from '@tanstack/react-query';
import { Window } from './Windows';
import { Drawing } from '@shared/schema';

export function DrawingsViewer() {
  const { data: drawings = [] } = useQuery<Drawing[]>({
    queryKey: ['/api/drawings'],
  });

  return (
    <Window title="Drawings" windowId="drawings" defaultPosition={{ x: 500, y: 100 }}>
      <div className="w-80 h-80 overflow-auto grid grid-cols-2 gap-2 p-2">
        {drawings.map((drawing) => (
          <div key={drawing.id} className="border border-cs-border p-1">
            <img
              src={drawing.imageData}
              alt={`Drawing ${drawing.id}`}
              className="w-full h-auto"
            />
            <div className="text-xs space-y-1 mt-1">
              <div className="font-bold">{drawing.name}</div>
              <div>by {drawing.author}</div>
              <div>{new Date(drawing.timestamp).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </Window>
  );
}