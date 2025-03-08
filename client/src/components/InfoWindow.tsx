import { Window } from './Windows';

export function InfoWindow() {
  return (
    <Window title="readme" windowId="info" defaultPosition={{ x: 75, y: 105 }}>
      <div className="w-64 space-y-4">
        <div className="text-sm">
          <p className="mb-2">
            inspired by <a href="https://hardanimeshirts.com">hardanimeshirts</a>
          </p>
          <p className="mb-2">
            /help in chat to see commands
          </p>
          <p>
            &lt;3
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