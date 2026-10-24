import { fail, type AppServer } from "./lib/http";
import { chatRoutes, chatSocket, initChat } from "./routes/chat";
import { clickerRoutes } from "./routes/clicker";
import { contactRoutes } from "./routes/contact";
import { drawingRoutes } from "./routes/drawings";
import { musicRoutes } from "./routes/music";
import { scoreRoutes } from "./routes/scores";
import { serveStatic } from "./static";

export function startServer({ port, hostname }: { port: number; hostname: string }): AppServer {
  const server: AppServer = Bun.serve({
    port,
    hostname,
    maxRequestBodySize: 12 * 1024 * 1024,

    routes: {
      ...scoreRoutes,
      ...clickerRoutes,
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
  return server;
}
