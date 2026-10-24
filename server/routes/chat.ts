import { join } from "node:path";
import { z } from "zod";
import type { BunRequest, ServerWebSocket, WebSocketHandler } from "bun";
import type { ChatServerEvent, Message } from "@shared/types";
import { DATA_DIR } from "../config";
import { JsonStore } from "../lib/json-store";
import { fail, json, parseJson, type AppServer } from "../lib/http";

const MAX_MESSAGES = 69;
const INITIAL_MESSAGES = 50;
const TOPIC = "chat";

interface MessagesData {
  messages: Message[];
  lastUpdated: string;
}

const store = await JsonStore.open<MessagesData>(
  join(DATA_DIR, "messages.json"),
  (raw) => {
    // Older versions stored a bare array.
    const messages = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as MessagesData | undefined)?.messages)
        ? (raw as MessagesData).messages
        : [];
    return { messages: messages.slice(-MAX_MESSAGES), lastUpdated: new Date().toISOString() };
  },
  2000,
);

let nextId = store.data.messages.reduce((m, msg) => Math.max(m, msg.id), 0) + 1;

const messageSchema = z.object({
  nickname: z.string().trim().min(1).max(50),
  content: z.string().trim().min(1).max(2000),
});

let server: AppServer;

/** Store a message and push it to every connected client. */
function postMessage(input: z.infer<typeof messageSchema>): Message {
  const message: Message = { id: nextId++, ...input, timestamp: new Date().toISOString() };
  store.data.messages = [...store.data.messages, message].slice(-MAX_MESSAGES);
  store.data.lastUpdated = message.timestamp;
  store.save();
  server.publish(TOPIC, JSON.stringify({ type: "new_message", message } satisfies ChatServerEvent));
  return message;
}

const send = (ws: ServerWebSocket<undefined>, event: ChatServerEvent) => ws.send(JSON.stringify(event));

export const chatSocket: WebSocketHandler<undefined> = {
  open(ws) {
    ws.subscribe(TOPIC);
    send(ws, { type: "initial_messages", messages: store.data.messages.slice(-INITIAL_MESSAGES) });
  },
  message(ws, raw) {
    let data: unknown;
    try {
      data = JSON.parse(String(raw));
    } catch {
      send(ws, { type: "error", message: "Invalid message format" });
      return;
    }
    if ((data as { type?: string })?.type !== "chat_message") return;
    const parsed = messageSchema.safeParse(data);
    if (parsed.success) postMessage(parsed.data);
    else send(ws, { type: "error", message: "Invalid message data" });
  },
  close(ws) {
    ws.unsubscribe(TOPIC);
  },
};

export function initChat(s: AppServer) {
  server = s;
}

export const chatRoutes = {
  "/ws/chat": (req: BunRequest, s: AppServer) =>
    s.upgrade(req) ? undefined : fail(426, "Expected a WebSocket upgrade"),

  "/api/messages": {
    GET: () => json(store.data.messages),
    POST: async (req: BunRequest) => {
      const body = await parseJson(req, messageSchema);
      if (!body) return fail(400, "Invalid message data");
      const message = postMessage(body);
      return json({ success: true, message, totalMessages: store.data.messages.length });
    },
  },
};
