# win16

A retro desktop in the browser: music player, chat, paint + drawings gallery, clicker game, contact form.

React 19 + Vite + Tailwind 4 on the client, a single [Bun](https://bun.sh) server (`Bun.serve`) for the API, WebSocket chat and static files. Data is stored as JSON files in `data/` and `uploads/`.

## Development

```sh
bun install
cp .env.example .env   # optional: Discord webhook for the contact form
bun run dev            # Vite on :5173, API on :5000 (proxied)
```

`bun run check` typechecks, `bun run build` builds the client into `dist/public`, `bun run start` serves the built app.

Music: drop `.mp3` files into `client/public/assets/music/` (works on the server without a rebuild).

## Deployment

Every push to `main` runs CI (typecheck + build) and then deploys over SSH via GitHub Actions (`.github/workflows/deploy.yml`). The server runs `scripts/deploy.sh`, which pulls `main`, installs, builds and restarts the `win16` systemd user service (`deploy/win16.service`).

Connection details are repository secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`. On the server the deploy key is pinned in `authorized_keys` to the deploy command only:

```
command="cd ~/win16 && git fetch -q origin main && git reset -q --hard origin/main && exec ./scripts/deploy.sh",restrict ssh-ed25519 AAAA...
```

One-time server setup: install Bun, clone the repo to `~/win16`, add `.env`, run `sudo loginctl enable-linger $USER`, and put a reverse proxy (nginx) in front of `127.0.0.1:5000` with WebSocket upgrade headers.

Logs: `journalctl --user -u win16 -f`
