import { z } from "zod";
import type { BunRequest } from "bun";
import { DISCORD_WEBHOOK_URL } from "../config";
import { clientIp, fail, json, parseJson, type AppServer } from "../lib/http";
import { RateLimiter } from "../lib/rate-limit";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

// Anonymous input must never ping @everyone/roles/users in the Discord channel.
const NO_MENTIONS = { parse: [] as string[] };

const limiter = new RateLimiter(20, 10 * 60_000);

const messageSchema = z.object({ message: z.string().trim().min(1).max(2000) });

function webhookUrl(): string | null {
  if (!DISCORD_WEBHOOK_URL) {
    console.error("DISCORD_WEBHOOK_URL is not configured");
    return null;
  }
  // wait=true makes Discord return the created message (needed for attachment URLs).
  const url = new URL(DISCORD_WEBHOOK_URL);
  url.searchParams.set("wait", "true");
  return url.toString();
}

export const contactRoutes = {
  "/api/contact": {
    POST: async (req: BunRequest, server: AppServer) => {
      if (!limiter.take(clientIp(req, server))) return fail(429, "Too many messages. Try again later.");
      const body = await parseJson(req, messageSchema);
      if (!body) return fail(400, "Invalid message");
      const url = webhookUrl();
      if (!url) return fail(500, "Server configuration error");

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: body.message, allowed_mentions: NO_MENTIONS }),
      });
      if (!res.ok) {
        console.error("Discord webhook failed:", res.status, await res.text());
        return fail(502, "Failed to send message");
      }
      return json({ success: true });
    },
  },

  "/api/contact/upload": {
    POST: async (req: BunRequest, server: AppServer) => {
      if (!limiter.take(clientIp(req, server))) return fail(429, "Too many uploads. Try again later.");
      const form = await req.formData().catch(() => null);
      const file = form?.get("file");
      if (!(file instanceof File)) return fail(400, "No file uploaded");
      if (!file.type.startsWith("image/") || file.size > MAX_UPLOAD_BYTES) return fail(400, "Invalid image");
      const url = webhookUrl();
      if (!url) return fail(500, "Server configuration error");

      const payload = new FormData();
      payload.append("payload_json", JSON.stringify({ allowed_mentions: NO_MENTIONS }));
      payload.append("files[0]", file, file.name || "image.png");

      const res = await fetch(url, { method: "POST", body: payload });
      const data = res.ok ? ((await res.json()) as { attachments?: { url: string }[] }) : null;
      const attachmentUrl = data?.attachments?.[0]?.url;
      if (!attachmentUrl) {
        console.error("Discord upload failed:", res.status);
        return fail(502, "Failed to upload image");
      }
      return json({ url: attachmentUrl });
    },
  },
};
