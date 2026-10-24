import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { apply, newGame, type ClickerEvent, type ClickerState } from "@shared/clicker";
import type { ClickerSession, Drawing, Message, PowChallenge, Score } from "@shared/types";
import type { AppServer } from "../server/lib/http";

// Point the server at an empty temp directory holding a few legacy JSON files,
// so the tests also cover the one-time import into SQLite.
const dir = mkdtempSync(join(tmpdir(), "win16-test-"));
process.env.DATA_DIR = join(dir, "data");
process.env.UPLOADS_DIR = join(dir, "uploads");
process.env.DISCORD_WEBHOOK_URL = "";

const legacy = (path: string, data: unknown) => {
  const full = join(dir, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, JSON.stringify(data));
};
legacy("data/scores.json", {
  currentSeason: 2,
  seasons: {
    "1": [{ name: "old", score: 5, date: "2025-01-01T00:00:00.000Z" }],
    "2": [
      { name: "a", score: 10, date: "2025-01-02T00:00:00.000Z", prestige: 0, color: "theme-adaptive" },
      { name: "b", score: 3, date: "2025-01-03T00:00:00.000Z", prestige: 1, color: "amber-600" },
      { name: "a", score: 20, date: "2025-01-04T00:00:00.000Z", prestige: 0, color: "theme-adaptive" },
    ],
  },
});
legacy("data/messages.json", {
  messages: [{ id: 7, nickname: "x", content: "hello", timestamp: "2025-01-01T00:00:00.000Z" }],
});

let server: AppServer;
let base: string;

beforeAll(async () => {
  const { startServer } = await import("../server/app");
  server = startServer({ port: 0, hostname: "127.0.0.1" });
  base = `http://127.0.0.1:${server.port}`;
});

afterAll(async () => {
  await server.stop(true);
  (await import("../server/lib/db")).db.close();
  rmSync(dir, { recursive: true, force: true });
});

const get = <T>(path: string) => fetch(base + path).then(async (r) => ({ status: r.status, body: (await r.json()) as T }));
const post = <T>(path: string, data?: unknown) =>
  fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  }).then(async (r) => ({ status: r.status, body: (await r.json()) as T }));

describe("legacy import", () => {
  test("moves JSON files aside", () => {
    expect(existsSync(join(dir, "data/scores.json.migrated"))).toBe(true);
    expect(existsSync(join(dir, "data/scores.json"))).toBe(false);
  });

  test("seasons", async () => {
    expect((await get("/api/seasons")).body).toEqual({ seasons: [1, 2], currentSeason: 2 });
  });

  test("keeps each player's best score, prestige first", async () => {
    const { body } = await get<Score[]>("/api/scores");
    expect(body.map((s) => [s.name, s.score])).toEqual([
      ["b", 3],
      ["a", 20],
    ]);
    const season1 = await get<Score[]>("/api/scores?season=1");
    expect(season1.body).toEqual([
      { name: "old", score: 5, date: "2025-01-01T00:00:00.000Z", prestige: 0, color: "theme-adaptive" },
    ]);
  });

  test("unknown season is a 404", async () => {
    expect((await get("/api/scores?season=9")).status).toBe(404);
    expect((await get("/api/scores?season=abc")).status).toBe(404);
  });
});

describe("chat", () => {
  test("posts continue the old ids and reach websocket clients", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws/chat`);
    const events: { type: string; messages?: Message[]; message?: Message }[] = [];
    ws.onmessage = (e) => events.push(JSON.parse(String(e.data)));
    await new Promise((r) => (ws.onopen = r));
    await Bun.sleep(50);
    expect(events[0].type).toBe("initial_messages");
    expect(events[0].messages!.map((m) => m.id)).toEqual([7]);

    const { body } = await post<{ message: Message }>("/api/messages", { nickname: "n", content: " hi " });
    expect(body.message).toMatchObject({ id: 8, nickname: "n", content: "hi" });
    await Bun.sleep(50);
    expect(events.at(-1)).toMatchObject({ type: "new_message", message: { id: 8 } });
    ws.close();

    expect((await post("/api/messages", { nickname: "", content: "x" })).status).toBe(400);
  });

  test("keeps the latest 69 messages", async () => {
    for (let i = 0; i < 70; i++) await post("/api/messages", { nickname: "n", content: `m${i}` });
    const { body } = await get<Message[]>("/api/messages");
    expect(body).toHaveLength(69);
    expect(body.at(-1)!.content).toBe("m69");
  });
});

describe("drawings", () => {
  // 1x1 transparent PNG
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

  const solve = (c: PowChallenge, clientId: string) => {
    for (let nonce = 0; ; nonce++) {
      const hash = new Bun.CryptoHasher("sha256").update(`${c.prefix}:${c.challengeId}:${clientId}:${nonce}`).digest("hex");
      if (hash.startsWith("0".repeat(c.difficulty))) return { challengeId: c.challengeId, nonce, hash };
    }
  };

  const vote = async (id: number, clientId: string) => {
    const { body: challenge } = await get<PowChallenge>("/api/vote/pow-challenge");
    return post<Drawing>(`/api/drawings/${id}/vote`, { voteType: "up", clientId, pow: solve(challenge, clientId) });
  };

  test("upload, list and vote once", async () => {
    const { body: drawing } = await post<Drawing>("/api/drawings", { name: "cat", image: png });
    expect(drawing).toMatchObject({ id: 1, name: "cat", author: "Anonymous", score: 0, imageData: "/uploads/drawing-1.png" });
    expect(await Bun.file(join(dir, "uploads/drawing-1.png")).exists()).toBe(true);

    const first = await vote(1, "client-a");
    expect(first.body).toMatchObject({ score: 1, upvotes: 1 });
    // Same IP again: votes are final, nothing changes.
    expect((await vote(1, "client-b")).body).toMatchObject({ score: 1, upvotes: 1 });

    const { body: list } = await get<Drawing[]>("/api/drawings?sortBy=score");
    expect(list.map((d) => d.id)).toEqual([1]);
  });

  test("rejects bad input", async () => {
    expect((await post("/api/drawings", { name: "x", image: "data:text/html;base64,AAAA" })).status).toBe(400);
    const { body: challenge } = await get<PowChallenge>("/api/vote/pow-challenge");
    const bad = { challengeId: challenge.challengeId, nonce: 0, hash: "0000" };
    expect((await post("/api/drawings/1/vote", { voteType: "up", clientId: "c", pow: bad })).status).toBe(400);
  });
});

describe("clicker", () => {
  const CLICK = 0;
  const MULTIPLIER = 1;

  /** Replays events locally the same way the server does. */
  const play = (state: ClickerState, events: ClickerEvent[]) =>
    events.reduce((s, e) => apply(s, e)!.state, state);

  const newSession = async () => (await post<ClickerSession>("/api/clicker")).body;

  test("a fresh game", async () => {
    const session = await newSession();
    expect(session.state).toEqual(newGame(session.state.rng));
    expect((await get<ClickerSession>(`/api/clicker/${session.id}`)).body).toEqual(session);
    expect((await get(`/api/clicker/nope`)).status).toBe(404);
  });

  test("the server agrees with the browser's replay, and the saved score is the server's", async () => {
    const session = await newSession();
    const clicks: ClickerEvent[] = Array.from({ length: 80 }, (_, i) => [i * 55, CLICK]);
    const batch1 = clicks.slice(0, 50);
    const r1 = await post<ClickerSession>(`/api/clicker/${session.id}/events`, { events: batch1 });
    expect(r1.status).toBe(200);
    const local = play(session.state, batch1);
    expect(r1.body.state).toEqual(local);

    const rest = clicks.slice(50);
    const finalLocal = play(local, rest);
    expect((await post(`/api/clicker/${session.id}/events`, { events: rest })).status).toBe(200);
    const save = await post<ClickerSession>(`/api/clicker/${session.id}/save`, { name: "player", t: 4400 });
    expect(save.status).toBe(200);
    // Saving resets the game.
    expect(save.body.state.count).toBe(0);

    const { body: scores } = await get<Score[]>("/api/scores");
    expect(scores.find((s) => s.name === "player")?.score).toBe(Math.floor(finalLocal.count));
  });

  test("rejects clicking faster than a person can", async () => {
    const session = await newSession();
    const tooFast: ClickerEvent[] = Array.from({ length: 30 }, (_, i) => [i * 10, CLICK]);
    const r = await post<ClickerSession>(`/api/clicker/${session.id}/events`, { events: tooFast });
    expect(r.status).toBe(409);
    // The allowed clicks before the limit still count.
    expect(r.body.state.count).toBeGreaterThanOrEqual(20);
    expect(r.body.state.count).toBeLessThan(30 * 5);
  });

  test("rejects a game clock running ahead of real time", async () => {
    const session = await newSession();
    const r = await post(`/api/clicker/${session.id}/events`, { events: [[60 * 60_000, CLICK]] });
    expect(r.status).toBe(409);
  });

  test("rejects buying what you can't afford", async () => {
    const session = await newSession();
    const r = await post<ClickerSession>(`/api/clicker/${session.id}/events`, { events: [[0, MULTIPLIER]] });
    expect(r.status).toBe(409);
    expect(r.body.state.multiplier).toBe(1);
  });

  test("rejects time going backwards", async () => {
    const session = await newSession();
    const events: ClickerEvent[] = [
      [500, CLICK],
      [100, CLICK],
    ];
    expect((await post(`/api/clicker/${session.id}/events`, { events })).status).toBe(409);
  });

  test("a score of 0 isn't saved", async () => {
    const session = await newSession();
    expect((await post(`/api/clicker/${session.id}/save`, { name: "zero", t: 0 })).status).toBe(400);
  });

  test("reset keeps prestige and the clock", async () => {
    const session = await newSession();
    await post(`/api/clicker/${session.id}/events`, { events: [[100, CLICK]] });
    const { body } = await post<ClickerSession>(`/api/clicker/${session.id}/reset`);
    expect(body.state).toMatchObject({ count: 0, t: 100, prestige: 0 });
  });

  test("the old unchecked endpoint is gone", async () => {
    expect((await post("/api/scores", { name: "cheat", score: 1e12 })).status).toBe(410);
  });
});

describe("misc", () => {
  test("unknown API routes are JSON 404s", async () => {
    const { status, body } = await get<{ error: string }>("/api/nope");
    expect(status).toBe(404);
    expect(body.error).toBe("Not found");
  });

  test("contact without a webhook fails cleanly", async () => {
    const { status } = await post("/api/contact", { message: "hi" });
    expect(status).toBeGreaterThanOrEqual(500);
  });
});

