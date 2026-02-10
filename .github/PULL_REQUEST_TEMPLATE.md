## Summary

<!-- 1-3 bullets. What changed and why. -->

-

## Backend endpoint(s) called

<!-- List every endpoint this PR adds, modifies, or depends on. -->
<!-- Format: METHOD /api/path — brief purpose -->
<!-- Write "None" for frontend-only or docs changes. -->

| Method | Path | Purpose |
|--------|------|---------|
|        |      |         |

## Regression note

<!-- What could this break? Which adjacent surfaces should be spot-checked? -->
<!-- "None expected" is acceptable if true. -->

## Verification trace

<!-- REQUIRED for workspace-touching, cross-service, or data-flow PRs. -->
<!-- Optional but encouraged for all others. -->
<!-- 3-6 mechanical bullets. No prose, no hedging. -->

<!--
Example:
1. **Trigger:** Switch workspace to Plan → open Export panel.
2. **State:** workspaceStore.boundProjectId = `abc-123`.
3. **API:** Frontend calls `GET /api/exports/sessions?userId=...` with bound project.
4. **Result:** Panel renders sessions for bound project; changing binding refreshes fetch + UI.
5. **Edge:** No sessions → empty state shown, not spinner.
-->

1. **Trigger:**
2. **State:**
3. **API:**
4. **Result:**

## Merge checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes (0 errors)
- [ ] Verification trace included (required for workspace / cross-service PRs)
- [ ] No direct `localhost` calls from frontend to external services
- [ ] No `--pub-*` / `--ws-*` token boundary crossings
