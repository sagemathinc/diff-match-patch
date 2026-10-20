#!/bin/bash
# Build this branch, fetch the published 1.0.1, and run the comparisons.
# Usage (from the repository root): scripts/compare/run.sh
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
(cd "$tmp" && npm pack --silent @cocalc/diff-match-patch@1.0.1 >/dev/null && tar -xzf cocalc-diff-match-patch-1.0.1.tgz)
npx tsc --project ./tsconfig.lib.json --outDir "$tmp/new"
for script in "$here"/*.js; do
  case "$(basename "$script")" in lib.js) continue ;; esac
  echo "== $(basename "$script")"
  if grep -q "<1.0.1 lib>" "$script"; then
    node "$script" "$tmp/package/dist/lib/index.js" "$tmp/new/index.js"
  else
    node "$script" "$tmp/new/index.js"
  fi
done
