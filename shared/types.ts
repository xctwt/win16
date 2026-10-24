// Types shared between the Bun server and the React client.

export interface Message {
  id: number;
  nickname: string;
  content: string;
  timestamp: string; // ISO date
}

export interface Drawing {
  id: number;
  name: string;
  author: string;
  imageData: string; // public URL of the stored image, e.g. /uploads/drawing-1.png
  timestamp: string; // ISO date
  score: number; // upvotes - downvotes
  upvotes: number;
  downvotes: number;
}

export type VoteType = "up" | "down";

export interface PowChallenge {
  challengeId: string;
  prefix: string;
  difficulty: number; // leading zero hex chars required
  expiresAt: number; // epoch ms
}

/** Proof-of-work solution sent with a vote. */
export interface PowPayload {
  challengeId: string;
  nonce: number;
  hash: string;
}

export interface Score {
  name: string;
  score: number;
  date: string; // ISO date
  prestige: number;
  color: string;
}

export interface SeasonsResponse {
  seasons: number[];
  currentSeason: number;
}

export interface Track {
  title: string;
  artist: string;
  url: string;
}

/** Messages sent over the /ws/chat socket. */
export type ChatServerEvent =
  | { type: "initial_messages"; messages: Message[] }
  | { type: "new_message"; message: Message }
  | { type: "error"; message: string };

export type ChatClientEvent = { type: "chat_message"; nickname: string; content: string };
