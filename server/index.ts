import { startServer } from "./app";
import { HOST, PORT } from "./config";
import { db } from "./lib/db";

const server = startServer({ port: PORT, hostname: HOST });
console.log(`win16 listening on http://${server.hostname}:${server.port}`);

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  await server.stop(true);
  db.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
