#!/bin/bash
# Block stackit checkout and stackit restack during sessions.
#
# Rule: NEVER navigate between stack branches to apply fixes.
# All fixes go on the current branch. Restacking rewrites history
# and forces pushes on downstream branches.
#
# Allowed alternatives:
#   stackit sync   — pull main, cleanup merged branches
#   stackit up/down — only via /stack-status skill
#   stackit log    — inspect stack

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if echo "$COMMAND" | grep -qE 'stackit\s+(checkout|restack)'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "BLOCKED: stackit checkout/restack is forbidden. Fix review comments by committing on the current branch. See CLAUDE.md Non-Negotiable Rules."
    }
  }'
else
  exit 0
fi
