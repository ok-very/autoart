#!/usr/bin/env bash
set -euo pipefail

require() { command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1"; exit 1; }; }

require git
require gh

# Enforce clean tree - stage + commit in VS Code first
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree not clean."
  echo "Commit (or stash) your changes first, then re-run."
  exit 1
fi

base_branch="$(git rev-parse --abbrev-ref HEAD)"

echo "Base branch (parent PR branch): ${base_branch}"

read -rp "New stacked branch name: " new_branch
if [[ -z "${new_branch}" ]]; then
  echo "Branch name required."
  exit 1
fi

# Create new branch from current HEAD (i.e., stacked on base_branch)
git switch -c "${new_branch}"
git push -u origin "${new_branch}"

read -rp "PR title: " pr_title
if [[ -z "${pr_title}" ]]; then
  echo "PR title required."
  exit 1
fi

echo "Enter PR body (Ctrl-D to finish):"
pr_body_file="$(mktemp)"
cat > "${pr_body_file}"

gh pr create \
  --base "${base_branch}" \
  --head "${new_branch}" \
  --title "${pr_title}" \
  --body-file "${pr_body_file}"

rm -f "${pr_body_file}"

echo "Done: created PR ${new_branch} -> ${base_branch}"
