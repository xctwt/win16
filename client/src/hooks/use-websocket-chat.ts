import { useEffect, useRef, useCallback, useState } from 'react';
import type { Message } from '@shared/schema';

interface WebSocketMessage {
  type: 'initial_messages' | 'new_message' | 'error';
  messages?: Message[];
  message?: Message | string;
}

interface UseWebSocketChatReturn {
  messages: Message[];
  sendMessage: (nickname: string, content: string) => void;
  isConnected: boolean;
  isConnecting: boolean;
}

export function useWebSocketChat(): UseWebSocketChatReturn {
  const ws = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeout = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    // Prevent multiple connection attempts
    if (ws.current?.readyState === WebSocket.OPEN || 
        ws.current?.readyState === WebSocket.CONNECTING || 
        isConnecting) {
      if (import.meta.env.DEV) console.log('WebSocket already connecting or connected, skipping...');
      return;
    }

    // Clean up any existing connection
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }

    setIsConnecting(true);
    if (import.meta.env.DEV) console.log('Connecting to WebSocket...');

    try {
      // Connect to the same host and port as the current website
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/chat`;
      
      if (import.meta.env.DEV) console.log('Connecting to WebSocket at:', wsUrl);
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        if (import.meta.env.DEV) console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttempts.current = 0;
      };

      ws.current.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          
          switch (data.type) {
            case 'initial_messages':
              if (data.messages) {
                setMessages(data.messages);
              }
              break;
            case 'new_message':
              if (data.message && typeof data.message === 'object') {
                setMessages(prev => [...prev, data.message as Message]);
              }
              break;
            case 'error':
              console.error('WebSocket error from server:', data.message);
              break;
            default:
              if (import.meta.env.DEV) console.warn('Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current.onclose = (event) => {
        if (import.meta.env.DEV) console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        ws.current = null;
        
        // Only attempt to reconnect if it wasn't a clean close and we haven't exceeded max attempts
        if (event.code !== 1000 && event.code !== 1001 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          if (import.meta.env.DEV) console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeout.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          if (import.meta.env.DEV) console.log('Max reconnection attempts reached');
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnecting(false);
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setIsConnecting(false);
    }
  }, []); // Remove isConnecting dependency

  const sendMessage = useCallback((nickname: string, content: string) => {
    if (import.meta.env.DEV) console.log('Attempting to send message:', { nickname, content, wsState: ws.current?.readyState });
    
    if (ws.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'chat_message',
        nickname,
        content
      };
      try {
        const messageStr = JSON.stringify(message);
        ws.current.send(messageStr);
        if (import.meta.env.DEV) console.log('Message sent successfully');
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    } else {
      if (import.meta.env.DEV) {
        console.warn('WebSocket not connected, cannot send message. State:', ws.current?.readyState);
        const state = ws.current?.readyState ?? WebSocket.CLOSED;
        const stateNames = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
        console.warn('WebSocket state:', stateNames[state] || 'UNKNOWN');
      }
    }
  }, []);

  useEffect(() => {
    // Only connect if not already connected or connecting
    if (!ws.current || (ws.current.readyState !== WebSocket.OPEN && ws.current.readyState !== WebSocket.CONNECTING)) {
      connect();
    }

    return () => {
      if (import.meta.env.DEV) console.log('Cleaning up WebSocket connection...');
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = undefined;
      }
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.close(1000, 'Component unmounting');
      }
      ws.current = null;
      setIsConnected(false);
      setIsConnecting(false);
    };
  }, []); // Remove connect dependency to prevent reconnection loops

  return {
    messages,
    sendMessage,
    isConnected,
    isConnecting
  };
}