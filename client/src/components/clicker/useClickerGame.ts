import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACTION_CODES,
  MAX_CLICKS_PER_SECOND,
  advance,
  apply,
  type Action,
  type ApplyResult,
  type ClickerEvent,
  type ClickerState,
} from "@shared/clicker";
import type { ClickerSession } from "@shared/types";

const SESSION_KEY = "clickerSession";
const SYNC_INTERVAL_MS = 3000;
const DISPLAY_INTERVAL_MS = 100;

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: Partial<ClickerSession>,
  ) {
    super(message);
  }
}

async function request(method: "GET" | "POST", path: string, body?: unknown, keepalive = false): Promise<ClickerSession> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    keepalive,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status, data.error || `Request failed (${res.status})`, data);
  return data;
}

async function loadSession(): Promise<ClickerSession> {
  const saved = localStorage.getItem(SESSION_KEY);
  if (saved) {
    try {
      return await request("GET", `/api/clicker/${encodeURIComponent(saved)}`);
    } catch (e) {
      if (!(e instanceof HttpError && e.status === 404)) throw e;
    }
  }
  const session = await request("POST", "/api/clicker");
  localStorage.setItem(SESSION_KEY, session.id);
  return session;
}

/**
 * The clicker game. Moves apply instantly in the browser and are sent to the
 * server every few seconds, which replays them with the same rules
 * (shared/clicker.ts). Progress lives on the server, so it survives closing
 * the window; if the server ever disagrees, the game snaps to its version.
 */
export function useClickerGame({ onDesync }: { onDesync: (message: string) => void }) {
  const [id, setId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, setState] = useState<ClickerState | null>(null);

  // Game state including moves the server hasn't confirmed yet.
  const local = useRef<ClickerState | null>(null);
  const pending = useRef<ClickerEvent[]>([]);
  const recentClicks = useRef<number[]>([]);
  // Requests run one at a time, in order.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // Game clock: game time `clockT` at performance.now() `clockAt`.
  const clock = useRef({ t: 0, at: 0 });
  const onDesyncRef = useRef(onDesync);
  onDesyncRef.current = onDesync;

  const now = () => clock.current.t + Math.floor(performance.now() - clock.current.at);

  const refresh = useCallback(() => {
    if (local.current) setState(advance(local.current, now()));
  }, []);

  const adopt = useCallback(
    (session: ClickerSession) => {
      local.current = session.state;
      pending.current = [];
      recentClicks.current = [];
      if (session.state.t > now()) clock.current = { t: session.state.t, at: performance.now() };
      refresh();
    },
    [refresh],
  );

  const load = useCallback(() => {
    setLoadError(null);
    loadSession()
      .then((session) => {
        clock.current = { t: session.state.t, at: performance.now() };
        setId(session.id);
        adopt(session);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [adopt]);

  useEffect(load, [load]);

  /** Queue a request that runs after earlier ones finish. */
  const enqueue = useCallback(<T,>(job: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(job, job);
    queue.current = run.catch(() => {});
    return run;
  }, []);

  const sync = useCallback(
    (keepalive = false) =>
      enqueue(async () => {
        const events = pending.current;
        if (!id || !events.length) return;
        pending.current = [];
        try {
          await request("POST", `/api/clicker/${id}/events`, { events }, keepalive);
        } catch (e) {
          if (e instanceof HttpError && e.status === 409 && e.body.state) {
            adopt({ id, state: e.body.state });
            onDesyncRef.current(e.message);
          } else {
            // Offline or a server hiccup: try these moves again next time.
            pending.current = [...events, ...pending.current];
          }
        }
      }),
    [id, adopt, enqueue],
  );

  useEffect(() => {
    if (!id) return;
    const display = setInterval(refresh, DISPLAY_INTERVAL_MS);
    const timer = setInterval(() => void sync(), SYNC_INTERVAL_MS);
    const onHide = () => document.visibilityState === "hidden" && void sync(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(display);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      void sync(true); // window closed
    };
  }, [id, refresh, sync]);

  /** Make a move. Returns null if it isn't allowed right now. */
  const act = useCallback(
    (action: Action): ApplyResult | null => {
      if (!local.current) return null;
      const t = Math.max(now(), local.current.t);
      if (action === "click") {
        // Stay under the server's click-rate limit instead of getting rejected.
        const clicks = recentClicks.current;
        if (clicks.length >= MAX_CLICKS_PER_SECOND && t - clicks[clicks.length - MAX_CLICKS_PER_SECOND] < 1000) {
          return null;
        }
        clicks.push(t);
        if (clicks.length > MAX_CLICKS_PER_SECOND) clicks.shift();
      }
      const event: ClickerEvent = [t, ACTION_CODES.indexOf(action)];
      const result = apply(local.current, event);
      if (!result) return null;
      local.current = result.state;
      pending.current.push(event);
      refresh();
      return result;
    },
    [refresh],
  );

  /** Send everything, then put the score on the leaderboard and start over. */
  const save = useCallback(
    async (name: string) => {
      await sync();
      if (pending.current.length) throw new Error("Couldn't reach the server. Try again in a moment.");
      const session = await enqueue(() => request("POST", `/api/clicker/${id}/save`, { name, t: Math.max(now(), local.current?.t ?? 0) }));
      adopt(session);
    },
    [id, sync, enqueue, adopt],
  );

  const reset = useCallback(async () => {
    await sync();
    adopt(await enqueue(() => request("POST", `/api/clicker/${id}/reset`)));
  }, [id, sync, enqueue, adopt]);

  return { state, loadError, retry: load, act, save, reset };
}
