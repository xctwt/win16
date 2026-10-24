import { useEffect, useRef, useCallback, useState } from 'react';
import type { ChatClientEvent, ChatServerEvent, Message } from '@shared/types';

type Status = 'connecting' | 'connected' | 'disconnected';

const MAX_BACKOFF_MS = 10_000;

export function useWebSocketChat() {
  const ws = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>('connecting');

  useEffect(() => {
    let disposed = false;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      setStatus('connecting');
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${location.host}/ws/chat`);
      ws.current = socket;

      socket.onopen = () => {
        attempts = 0;
        setStatus('connected');
      };

      socket.onmessage = (event) => {
        let data: ChatServerEvent;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        if (data.type === 'initial_messages') setMessages(data.messages);
        else if (data.type === 'new_message') setMessages((prev) => [...prev, data.message]);
        else if (data.type === 'error') console.error('Chat error:', data.message);
      };

      socket.onclose = () => {
        ws.current = null;
        if (disposed) return;
        setStatus('disconnected');
        // Keep retrying with exponential backoff.
        const delay = Math.min(1000 * 2 ** attempts++, MAX_BACKOFF_MS);
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      ws.current?.close(1000);
      ws.current = null;
    };
  }, []);

  const sendMessage = useCallback((nickname: string, content: string) => {
    if (ws.current?.readyState !== WebSocket.OPEN) return;
    const event: ChatClientEvent = { type: 'chat_message', nickname, content };
    ws.current.send(JSON.stringify(event));
  }, []);

  return {
    messages,
    sendMessage,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
  };
}
