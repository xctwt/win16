import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
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

export const ChatWindow = memo(function ChatWindow() {
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

  const addLocalMessage = (content: string) => {
    const localMessage: Message = {
      id: Date.now(),
      nickname: 'System',
      content,
      timestamp: new Date(),
    };
    setLocalMessages((prev) => [...prev, localMessage]);
  };

  const handleNicknameCommand = (newNick: string) => {
    const trimmedNick = newNick.trim();
    if (trimmedNick) {
      const oldNick = nickname;
      const newNickname = `${trimmedNick}${generateRandomNumber()}`;
      setNickname(newNickname);
      addLocalMessage(`Nickname changed from ${oldNick} to ${newNickname}`);
    }
  };

  const handleCommands = (command: string) => {
    switch (command) {
      case '/rgb':
        setIsRainbow(!isRainbow);
        addLocalMessage(`Rainbow mode ${isRainbow ? 'disabled' : 'enabled'}`);
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
        addLocalMessage(helpMessage);
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

  const getRainbowStyle = useCallback((index: number) => {
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
  }, [isRainbow]);

  // Combine server messages with local system messages
  const displayMessages = useMemo(() => 
    localMessages.map((msg) => ({
      ...msg,
      isSystem: msg.nickname === 'System',
    }))
  , [localMessages]);

  const formatTimestamp = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const defaultPosition = useMemo(() => ({ x: 75, y: 205 }), []);

  return (
    <Window title="chat" windowId="chat" defaultPosition={defaultPosition}>
      <div className="w-80 h-64 flex flex-col">
        <div className="flex-1 overflow-auto mb-4">
          {displayMessages.map((msg, index) => (
            <div key={msg.id} className="mb-2">
              {msg.isSystem ? (
                // System messages (commands) in italic and different color
                <div className="text-cs-border italic">{msg.content}</div>
              ) : (
                // Regular chat messages
                <div>
                  <span className="text-xs text-gray-500 ml-1">
                    {formatTimestamp(msg.timestamp)}{' '}
                  </span>
                  <span className="font-bold">{msg.nickname}: </span>
                  <span style={getRainbowStyle(index)}>{msg.content}</span>
                  
                </div>
              )}
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
});
