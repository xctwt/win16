// pm2 process file: `pm2 start ecosystem.config.cjs` (after `bun install && bun run build`)
module.exports = {
  apps: [
    {
      name: "win16",
      cwd: __dirname,
      script: "server/index.ts",
      interpreter: "bun",
      env: {
        NODE_ENV: "production",
        PORT: "5000",
      },
      max_memory_restart: "256M",
      kill_timeout: 5000,
    },
  ],
};
