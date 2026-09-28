#!/bin/bash
# Prepares a Claude Code on the web session so `npm test` works right away.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# The app needs Node 22.5+ for its built-in SQLite.
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if (a<22||(a===22&&b<5)) { console.error("Node "+process.versions.node+" found; TNL LABS needs 22.5+"); process.exit(1) }'

npm install --no-audit --no-fund --no-package-lock
