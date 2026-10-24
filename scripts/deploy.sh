#!/usr/bin/env bash
# Deploys win16 on the server.
#
#   CI:   ssh <server> "deploy <commit-sha>" < client-build.tar.gz
#         (the deploy key's forced command runs this script; the built client arrives on stdin)
#   Hand: ./scripts/deploy.sh   (deploys origin/main and builds the client on the server)
#
# Everything lives in main() so bash has parsed the whole file before `git reset` rewrites it.
set -euo pipefail

main() {
  cd "$(dirname "$(readlink -f "$0")")/.."
  export PATH="$HOME/.bun/bin:$PATH"

  # One deploy at a time
  exec 9>/tmp/win16-deploy.lock
  flock 9

  local sha=""
  if [[ "${SSH_ORIGINAL_COMMAND:-}" =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
    sha="${BASH_REMATCH[1]}"
  fi

  echo "==> Updating source"
  git fetch --quiet origin main
  if [ -n "$sha" ]; then
    git merge-base --is-ancestor "$sha" origin/main || { echo "    $sha is not on main" >&2; return 1; }
    git reset --hard --quiet "$sha"
  else
    git reset --hard --quiet origin/main
  fi
  echo "    $(git log -1 --format='%h %s')"

  rm -rf dist/public-next
  mkdir -p dist/public-next
  if [ -n "$sha" ]; then
    echo "==> Installing runtime dependencies"
    bun install --frozen-lockfile --production --silent
    echo "==> Unpacking client build from CI"
    tar -xzf - -C dist/public-next
  else
    echo "==> Installing dependencies"
    bun install --frozen-lockfile --silent
    echo "==> Building client"
    bunx vite build --logLevel warn --outDir "$PWD/dist/public-next"
  fi
  [ -f dist/public-next/index.html ] || { echo "    Client build is missing index.html" >&2; return 1; }

  # Keep the previous build's chunks so open tabs can still lazy-load windows; prune old ones.
  if [ -d dist/public/assets ]; then
    cp -rp --update=none dist/public/assets/. dist/public-next/assets/
    find dist/public-next/assets -type f -mtime +14 -delete
  fi
  rm -rf dist/public-prev
  if [ -d dist/public ]; then mv dist/public dist/public-prev; fi
  mv dist/public-next dist/public
  rm -rf dist/public-prev

  echo "==> Restarting"
  export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
  install -Dm644 deploy/win16.service "$HOME/.config/systemd/user/win16.service"
  systemctl --user daemon-reload
  # One-time migration: the app used to run under pm2 on the same port.
  if command -v pm2 >/dev/null && pm2 describe my-fullstack-app >/dev/null 2>&1; then
    pm2 delete my-fullstack-app >/dev/null && pm2 save --force >/dev/null
  fi
  systemctl --user enable --quiet win16
  systemctl --user restart win16

  echo "==> Health check"
  for _ in $(seq 1 20); do
    if curl -fs -o /dev/null "http://127.0.0.1:${PORT:-5000}/api/seasons"; then
      echo "    OK"
      return 0
    fi
    sleep 1
  done
  echo "    Server did not become healthy; recent logs:" >&2
  journalctl --user -u win16 -n 30 --no-pager >&2 || true
  return 1
}

main "$@"
exit
