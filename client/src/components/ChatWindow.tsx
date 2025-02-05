import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Window } from './Windows';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Message } from '@shared/schema';

function generateRandomNumber() {
  return Math.floor(Math.random() * 9000 + 1000);
}

function generateDefaultNickname() {
  return `anonymous${generateRandomNumber()}`;
}

export function ChatWindow() {
  const [message, setMessage] = useState('');
  const [nickname, setNickname] = useState(generateDefaultNickname());
  const [isRainbow, setIsRainbow] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['/api/messages'],
    refetchInterval: 300,
  });

  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  const mutation = useMutation({
    mutationFn: async (content: string) => {
      await apiRequest('POST', '/api/messages', { nickname, content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages]);

  const handleNicknameCommand = (newNick: string) => {
    const trimmedNick = newNick.trim();
    if (trimmedNick) {
      setNickname(`${trimmedNick}${generateRandomNumber()}`);
      mutation.mutate('changed successfully');
    }
  };

  const handleCommands = (command: string) => {
    switch (command) {
      case '/rgb':
        setIsRainbow(!isRainbow);
        mutation.mutate(`Rainbow mode ${isRainbow ? 'disabled' : 'enabled'}`);
        break;
      case '/clear':
        setLocalMessages([]);
        break;
      case '/help':
        const helpMessage = [
          'Available commands:',
          '/nick <nickname> - Change your nickname',
          '/rgb - Toggle rainbow text mode',
          '/clear - Clear chat history',
          '/help - Show this help message',
        ].join('\n');
        mutation.mutate(helpMessage);
        break;
      default:
        return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();

    if (trimmedMessage) {
      if (trimmedMessage.startsWith('/nick ')) {
        const newNick = trimmedMessage.slice(6);
        handleNicknameCommand(newNick);
      } else if (!handleCommands(trimmedMessage)) {
        mutation.mutate(trimmedMessage);
      }
      setMessage('');
    }
  };

  const getRainbowStyle = (index: number) => {
    if (!isRainbow) return {};
    const hue = (index * 30) % 360;
    return {
      background: `linear-gradient(90deg, 
        hsl(${hue}, 100%, 50%), 
        hsl(${(hue + 60) % 360}, 100%, 50%))`,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      padding: '2px 0',
    };
  };

  return (
    <Window title="chat" windowId="chat" defaultPosition={{ x: 20, y: 300 }}>
      <div className="w-80 h-64 flex flex-col">
        <div className="flex-1 overflow-auto mb-4">
          {localMessages.map((msg, index) => (
            <div key={msg.id} className="mb-2">
              <span className="font-bold">{msg.nickname}: </span>
              <span style={getRainbowStyle(index)}>{msg.content}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="cs-input flex-1"
          />
          <button
            type="submit"
            className="cs-button"
            disabled={mutation.isPending}
          >
            Send
          </button>
        </form>
      </div>
    </Window>
  );
}
