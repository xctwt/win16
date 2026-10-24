import { HOST, PORT } from "./config";
import { fail, type AppServer } from "./lib/http";
import { flushAllStores } from "./lib/json-store";
import { chatRoutes, chatSocket, initChat } from "./routes/chat";
import { contactRoutes } from "./routes/contact";
import { drawingRoutes } from "./routes/drawings";
import { musicRoutes } from "./routes/music";
import { scoreRoutes } from "./routes/scores";
import { serveStatic } from "./static";

const server: AppServer = Bun.serve({
  port: PORT,
  hostname: HOST,
  maxRequestBodySize: 12 * 1024 * 1024,

  routes: {
    ...scoreRoutes,
    ...drawingRoutes,
    ...chatRoutes,
    ...contactRoutes,
    ...musicRoutes,
    "/api/*": () => fail(404, "Not found"),
  },

  fetch: serveStatic,
  websocket: chatSocket,

  error(err) {
    console.error(err);
    return fail(500, "Internal Server Error");
  },
});

initChat(server);
console.log(`win16 listening on http://${server.hostname}:${server.port}`);

async function shutdown(signal: string) {
  console.log(`${signal} received, flushing data...`);
  await flushAllStores();
  await server.stop(true);
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
