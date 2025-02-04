import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Window } from './Windows';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Message } from '@shared/schema';

const ADJECTIVES = ['Legendary', 'Silent', 'Swift', 'Tactical', 'Sneaky'];
const NOUNS = ['Eagle', 'Wolf', 'Snake', 'Hawk', 'Tiger'];

function generateNickname() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}${noun}`;
}

export function ChatWindow() {
  const [message, setMessage] = useState('');
  const [nickname] = useState(generateNickname());
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['/api/messages'],
    refetchInterval: 3000,
  });

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
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      mutation.mutate(message.trim());
      setMessage('');
    }
  };

  return (
    <Window title="Chat" windowId="chat" defaultPosition={{ x: 20, y: 300 }}>
      <div className="w-80 h-64 flex flex-col">
        <div className="flex-1 overflow-auto mb-4">
          {messages.map((msg) => (
            <div key={msg.id} className="mb-2">
              <span className="font-bold">{msg.nickname}: </span>
              <span>{msg.content}</span>
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
          <button type="submit" className="cs-button" disabled={mutation.isPending}>
            Send
          </button>
        </form>
      </div>
    </Window>
  );
}