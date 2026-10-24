import type { Server } from "bun";
import type { z } from "zod";

export type AppServer = Server<undefined>;

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export const fail = (status: number, error: string) => Response.json({ error }, { status });

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/**
 * Real client IP. nginx sets X-Real-IP to the connecting address; it is only
 * trusted when the request actually comes from the local proxy. (X-Forwarded-For's
 * first entry is client-controlled, so it is never used.)
 */
export function clientIp(req: Request, server: AppServer): string {
  const peer = server.requestIP(req)?.address ?? "unknown";
  return (LOOPBACK.has(peer) && req.headers.get("x-real-ip")) || peer;
}

/** Parse and validate a JSON body. Returns null when it's missing or invalid. */
export async function parseJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S> | null> {
  const body = await req.json().catch(() => undefined);
  const result = schema.safeParse(body);
  return result.success ? result.data : null;
}

export const sha256 = (input: string) => new Bun.CryptoHasher("sha256").update(input).digest("hex");
