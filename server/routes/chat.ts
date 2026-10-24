import { z } from "zod";
import type { BunRequest, ServerWebSocket, WebSocketHandler } from "bun";
import type { ChatServerEvent, Message } from "@shared/types";
import { db } from "../lib/db";
import { fail, json, parseJson, type AppServer } from "../lib/http";

const MAX_MESSAGES = 69;
const INITIAL_MESSAGES = 50;
const TOPIC = "chat";

const insertMessage = db.query<Message, [string, string, string]>(
  "INSERT INTO messages (nickname, content, timestamp) VALUES (?, ?, ?) RETURNING id, nickname, content, timestamp",
);
const trimMessages = db.query<void, [number]>(
  "DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY id DESC LIMIT ?)",
);
const countMessages = db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM messages");
const latestMessages = db.query<Message, [number]>(
  "SELECT * FROM (SELECT id, nickname, content, timestamp FROM messages ORDER BY id DESC LIMIT ?) ORDER BY id",
);

trimMessages.run(MAX_MESSAGES);

const messageSchema = z.object({
  nickname: z.string().trim().min(1).max(50),
  content: z.string().trim().min(1).max(2000),
});

let server: AppServer;

/** Store a message and push it to every connected client. */
function postMessage(input: z.infer<typeof messageSchema>): Message {
  const message = insertMessage.get(input.nickname, input.content, new Date().toISOString())!;
  trimMessages.run(MAX_MESSAGES);
  server.publish(TOPIC, JSON.stringify({ type: "new_message", message } satisfies ChatServerEvent));
  return message;
}

const send = (ws: ServerWebSocket<undefined>, event: ChatServerEvent) => ws.send(JSON.stringify(event));

export const chatSocket: WebSocketHandler<undefined> = {
  open(ws) {
    ws.subscribe(TOPIC);
    send(ws, { type: "initial_messages", messages: latestMessages.all(INITIAL_MESSAGES) });
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
    GET: () => json(latestMessages.all(MAX_MESSAGES)),
    POST: async (req: BunRequest) => {
      const body = await parseJson(req, messageSchema);
      if (!body) return fail(400, "Invalid message data");
      const message = postMessage(body);
      return json({ success: true, message, totalMessages: countMessages.get()!.n });
    },
  },
};
