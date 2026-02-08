#!/bin/bash
# PreToolUse hook for git/stackit safety.
#
# DENY:
#   stackit checkout — NEVER navigate between stack branches to apply fixes
#   stackit restack  — rewrites history and forces pushes
#
# ASK (require user confirmation):
#   stackit merge    — destructive stack operation, confirm before proceeding
#   gh pr merge      — irreversible merge, confirm before proceeding

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Hard deny: stack navigation and restacking
if echo "$COMMAND" | grep -qE 'stackit\s+(checkout|restack)'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "BLOCKED: stackit checkout/restack is forbidden. Fix review comments by committing on the current branch. See CLAUDE.md Non-Negotiable Rules."
    }
  }'
  exit 0
fi

# Gate: merge operations require user confirmation
if echo "$COMMAND" | grep -qE 'stackit\s+merge|gh\s+pr\s+merge'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: "Merge operation detected. Confirm before proceeding — this is irreversible."
    }
  }'
  exit 0
fi

# Everything else: pass through
exit 0
