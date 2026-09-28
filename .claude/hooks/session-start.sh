#!/bin/bash
# Installs dependencies so cloud sessions (Claude Code on the web) can run tests.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

pip install -q -r backend/requirements.txt

if [ -f mobile/package.json ]; then
  (cd mobile && npm install --no-audit --no-fund)
fi
