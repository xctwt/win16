import { Window } from './Windows';

export function InfoWindow() {
  return (
    <Window title="whatever" windowId="info" defaultPosition={{ x: 300, y: 20 }}>
      <div className="w-64 space-y-4">
        <div className="text-sm">
          <p className="mb-2">
            hi
          </p>
          <p className="mb-2">
            what r u doing here?
          </p>
          <p>
            
          </p>
        </div>

        <div className="border-t border-cs-border pt-2">
          <p className="text-xs text-center">
            Made with HATE
          </p>
        </div>
      </div>
    </Window>
  );
}