#!/usr/bin/env bash
set -euo pipefail

matches=$(git grep -n -e '<<<<<<<' -e '=======' -e '>>>>>>>' -- . ':!scripts/no-merge-markers.sh' || true)
if [ -n "$matches" ]; then
  echo "Merge conflict markers found:" >&2
  echo "$matches" >&2
  exit 1
fi

echo "No merge conflict markers found."
