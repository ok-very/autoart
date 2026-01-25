#!/usr/bin/env bash
set -euo pipefail

require() { command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1"; exit 1; }; }

require gh

if [[ $# -lt 1 ]]; then
  echo "Usage: merge-stack.sh <prNumber> [<prNumber> ...]"
  exit 1
fi

for pr in "$@"; do
  echo "Merging PR #${pr} (merge commit)..."
  gh pr merge "${pr}" --merge --delete-branch
done

echo "Done."
