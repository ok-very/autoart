#!/bin/bash
# PreToolUse hook for git/stackit safety.
#
# Gates dangerous operations behind user confirmation ("ask").
# None are hard-denied — all have legitimate uses — but all
# warrant a pause before execution.
#
#   stackit checkout — switches branches, can lose uncommitted context
#   stackit restack  — rewrites history, force-pushes downstream
#   stackit merge    — irreversible stack merge
#   gh pr merge      — irreversible PR merge

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# stackit checkout — switching branches mid-work
if echo "$COMMAND" | grep -qE 'stackit\s+checkout'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: "Branch switch. Confirm uncommitted work is safe before proceeding."
    }
  }'
  exit 0
fi

# stackit restack — rebases all branches, force-pushes
if echo "$COMMAND" | grep -qE 'stackit\s+restack'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: "Restack rewrites history and force-pushes downstream branches. Confirm."
    }
  }'
  exit 0
fi

# stackit merge / gh pr merge — irreversible
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
