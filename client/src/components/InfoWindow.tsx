import { Window } from './Windows';

export function InfoWindow() {
  return (
    <Window title="About Me" windowId="info" defaultPosition={{ x: 300, y: 20 }}>
      <div className="w-64 space-y-4">
        <div className="text-sm">
          <p className="mb-2">
            👋 Hi, I'm a developer who loves retro games and web development!
          </p>
          <p className="mb-2">
            This website is inspired by Counter-Strike 1.6's iconic UI.
          </p>
          <p>
            🎮 Feel free to chat with others in the chat window or play some music!
          </p>
        </div>

        <div className="border-t border-cs-border pt-2">
          <p className="text-xs text-center">
            Made with ❤️ using React and Express
          </p>
        </div>
      </div>
    </Window>
  );
}