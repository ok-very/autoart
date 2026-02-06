---
name: improve
description: Analyze changes in the current stack and provide actionable improvement suggestions using parallel multi-agent analysis. Reviews bugs, simplification opportunities, performance, test coverage, documentation, security, UX, and PR review feedback. Keywords improve, code review, analysis, bugs, performance, security.
allowed-tools: Bash(git:*), Bash(gh:*), Read, Grep, Glob, Task
---

# /improve - Code Improvement Analysis

Analyze changes in the current stack and provide actionable improvement suggestions across multiple dimensions.

## Usage

```
/improve [scope] [--agents=<list>] [--pr]
```

**Scope options:**
- `stack` (default) - All changes from main to current branch
- `branch` - Only commits on current branch
- `staged` - Only staged changes

**Agent filter:**
- `--agents=all` (default) - Run all agents
- `--agents=bugs,perf` - Run specific agents only
- `--agents=review` - Run only the PR review feedback agent

**PR review:**
- `--pr` - Explicitly fetch and analyze PR review comments (auto-detected if PR exists)
- `--no-pr` - Skip PR review analysis even if a PR exists

## Execution Steps

### Step 1: Gather Context

First, collect information about the changes to analyze:

```bash
# Get the main/trunk branch name
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main"

# Get current branch
git branch --show-current

# Get list of changed files
git diff --name-only main...HEAD

# Get the full diff for analysis
git diff main...HEAD

# Get diff stats
git diff --stat main...HEAD
```

Store this information for the agents:
- `TRUNK_BRANCH`: The main branch name
- `CURRENT_BRANCH`: Current branch name
- `CHANGED_FILES`: List of files changed
- `DIFF_CONTENT`: The actual diff
- `DIFF_STATS`: Summary statistics

### Step 1b: Fetch PR Review Comments (Optional)

If analyzing a branch with an open PR, fetch review comments:

```bash
# Check if there's a PR for the current branch
gh pr view --json number,url,reviews,comments 2>/dev/null

# If PR exists, get detailed review comments (inline code comments)
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments --jq '.[] | {path: .path, line: .line, body: .body, user: .user.login, state: .state, created_at: .created_at}'

# Get PR review threads (conversation threads)
gh pr view --json reviewDecision,reviews --jq '{decision: .reviewDecision, reviews: [.reviews[] | {author: .author.login, state: .state, body: .body}]}'
```

Store this information:
- `PR_NUMBER`: The PR number (if exists)
- `PR_URL`: The PR URL
- `REVIEW_COMMENTS`: Inline code review comments with file/line info
- `REVIEW_THREADS`: General review comments and decisions
- `HAS_PR`: Boolean indicating if a PR exists for this branch

**Note:** If no PR exists (`gh pr view` returns error), skip the review agent and set `HAS_PR=false`.

### Step 2: Launch Analysis Agents

Launch ALL of the following agents in PARALLEL using the Task tool. Each agent receives the diff and changed files list.

**IMPORTANT:** You MUST launch all agents simultaneously in a single message with multiple Task tool calls. Do not run them sequentially.
- If `HAS_PR=true`: Launch all 8 agents (including review feedback agent)
- If `HAS_PR=false`: Launch 7 agents (skip review feedback agent)

---

#### Agent 1: Bug Hunter (`bugs`)

```
You are analyzing code changes for potential bugs and edge cases in a TypeScript/React/Fastify monorepo.

CHANGES TO ANALYZE:
- Branch: {CURRENT_BRANCH} vs {TRUNK_BRANCH}
- Files: {CHANGED_FILES}

DIFF:
{DIFF_CONTENT}

LOOK FOR:
1. Optional chaining gaps (accessing .foo on potentially undefined without ?.)
2. Unhandled Promise rejections (missing .catch(), missing try/catch on await)
3. Swallowed errors (catch blocks that log but don't rethrow or handle)
4. Off-by-one errors in array operations
5. Race conditions in React state updates (stale closures, missing deps in useEffect)
6. Resource leaks (unsubscribed event listeners, uncleaned useEffect, unclosed DB connections)
7. Unhandled edge cases (empty arrays, undefined props, null database results)
8. Logic errors in conditionals
9. Missing Zod validation at API boundaries
10. TanStack Query cache inconsistencies (missing invalidation after mutations)

OUTPUT FORMAT (JSON):
{
  "agent": "bugs",
  "findings": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "title": "Brief description",
      "file": "path/to/file.ts",
      "line": 142,
      "description": "Detailed explanation of the issue",
      "suggestion": "How to fix it",
      "effort": "LOW|MEDIUM|HIGH",
      "code_snippet": "relevant code if helpful"
    }
  ]
}

Only report ACTUAL issues found in the diff. Do not report speculative issues or issues in unchanged code.
If no issues found, return empty findings array.
```

---

#### Agent 2: Simplification (`simplify`)

```
You are analyzing code changes for simplification and refactoring opportunities in a TypeScript/React/Fastify monorepo.

CHANGES TO ANALYZE:
- Branch: {CURRENT_BRANCH} vs {TRUNK_BRANCH}
- Files: {CHANGED_FILES}

DIFF:
{DIFF_CONTENT}

LOOK FOR:
1. Duplicated code that could be extracted (but only if used 2+ places or >100 lines)
2. Complex conditionals that could be simplified
3. Deep nesting that could use early returns
4. Long components/functions that should be split
5. Dead code or unused variables/imports
6. Unnecessary type assertions (as) when inference suffices
7. Verbose patterns with simpler alternatives
8. Explicit entity type checks where soft-intrinsic derivation should be used
9. String literals that should be Zod enums or const objects
10. Over-engineering (premature abstractions, unnecessary helpers for one-time operations)

PROJECT STYLE RULES:
- Soft-intrinsic type derivation: derive types from relationships, never explicit entityType checks
- Zod as source of truth: derive TypeScript types from Zod schemas, don't duplicate
- Component extraction: extract at 2+ uses or >100 lines, inline at <50 lines if tightly coupled
- Early returns over deep nesting
- No inline styles or ad-hoc components — add to component library

OUTPUT FORMAT (JSON):
{
  "agent": "simplify",
  "findings": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "title": "Brief description",
      "file": "path/to/file.ts",
      "line": 42,
      "description": "What could be simplified",
      "suggestion": "Proposed simplification",
      "effort": "LOW|MEDIUM|HIGH",
      "code_before": "current code",
      "code_after": "simplified code"
    }
  ]
}
```

---

#### Agent 3: Performance (`perf`)

```
You are analyzing code changes for performance issues in a TypeScript/React/Fastify monorepo.

CHANGES TO ANALYZE:
- Branch: {CURRENT_BRANCH} vs {TRUNK_BRANCH}
- Files: {CHANGED_FILES}

DIFF:
{DIFF_CONTENT}

LOOK FOR:
1. Unnecessary React re-renders (missing memo, unstable references in props/deps)
2. Large lists without virtualization
3. N+1 query patterns in Fastify handlers
4. Missing TanStack Query caching (staleTime, gcTime not configured for stable data)
5. Expensive computations without useMemo
6. Blocking the main thread (heavy synchronous work in React components)
7. Inefficient algorithms (O(n²) when O(n) is possible)
8. Repeated database queries that could be batched
9. Missing indexes implied by new query patterns
10. Bundle size impact (importing entire libraries when tree-shaking is possible)

OUTPUT FORMAT (JSON):
{
  "agent": "perf",
  "findings": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "title": "Brief description",
      "file": "path/to/file.ts",
      "line": 89,
      "description": "Performance issue explanation",
      "impact": "Expected impact on performance",
      "suggestion": "How to optimize",
      "effort": "LOW|MEDIUM|HIGH"
    }
  ]
}
```

---

#### Agent 4: Test Coverage (`tests`)

```
You are analyzing code changes for test coverage gaps in a TypeScript/React/Fastify monorepo.

CHANGES TO ANALYZE:
- Branch: {CURRENT_BRANCH} vs {TRUNK_BRANCH}
- Files: {CHANGED_FILES}

DIFF:
{DIFF_CONTENT}

LOOK FOR:
1. New functions/handlers without corresponding tests
2. New error paths without test coverage
3. Edge cases not covered by existing tests
4. Changed behavior that needs test updates
5. Complex conditionals with untested branches
6. New API endpoints without integration tests
7. Zod schema changes without validation tests
8. React components with complex logic but no component tests

PROJECT TEST RULES:
- Vitest for all tests (describe/it blocks, not t.Parallel)
- Fastify integration tests: use app.inject() for route testing
- React component tests: use @testing-library/react
- Zod schemas: test edge cases and error messages
- Prefer focused assertions over snapshot tests

OUTPUT FORMAT (JSON):
{
  "agent": "tests",
  "findings": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "title": "Brief description",
      "file": "path/to/file.ts",
      "line": 50,
      "description": "What needs test coverage",
      "test_suggestion": "Outline of test to add",
      "effort": "LOW|MEDIUM|HIGH"
    }
  ]
}
```

---

#### Agent 5: Documentation (`docs`)

```
You are analyzing code changes for documentation needs in a TypeScript/React/Fastify monorepo.

CHANGES TO ANALYZE:
- Branch: {CURRENT_BRANCH} vs {TRUNK_BRANCH}
- Files: {CHANGED_FILES}

DIFF:
{DIFF_CONTENT}

LOOK FOR:
1. Non-obvious constraints that need JSDoc (don't add JSDoc to self-evident code)
2. Changed behavior not reflected in existing docs
3. New panel types not registered in panelRegistry.ts docs
4. Complex Action/Event flows that need explanatory comments
5. DESIGN.md updates needed for new design tokens or interaction patterns
6. Outdated comments that don't match code
7. New Zod schemas without usage documentation in shared/
8. Skill or agent configuration changes without CLAUDE.md updates

PROJECT DOC RULES:
- Comments explain "why" not "what"
- Only add JSDoc for non-obvious constraints, not self-evident code
- Design changes go in docs/DESIGN.md
- Skill/agent config changes go in relevant .claude/skills/ files
- Don't add docstrings to code you didn't change

OUTPUT FORMAT (JSON):
{
  "agent": "docs",
  "findings": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "title": "Brief description",
      "file": "path/to/file.ts",
      "line": 25,
      "description": "What documentation is needed",
      "suggestion": "Proposed documentation",
      "effort": "LOW|MEDIUM|HIGH"
    }
  ]
}
```

---

#### Agent 6: Security (`security`)

```
You are analyzing code changes for security issues (defensive review).

CHANGES TO ANALYZE:
- Branch: {CURRENT_BRANCH} vs {TRUNK_BRANCH}
- Files: {CHANGED_FILES}

DIFF:
{DIFF_CONTENT}

LOOK FOR:
1. XSS vulnerabilities (dangerouslySetInnerHTML, unescaped user content in React)
2. SQL injection (raw queries without parameterization)
3. Command injection vulnerabilities (unescaped shell arguments)
4. Path traversal vulnerabilities
5. Hardcoded secrets or credentials
6. Insufficient input validation (missing Zod validation at API boundaries)
7. Missing authentication/authorization checks on Fastify routes
8. Logging of sensitive data (link keys, tokens, credentials)
9. CORS misconfiguration
10. Unsafe use of user-controlled data in database queries or file operations

OUTPUT FORMAT (JSON):
{
  "agent": "security",
  "findings": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "title": "Brief description",
      "file": "path/to/file.ts",
      "line": 78,
      "description": "Security issue explanation",
      "risk": "What could go wrong",
      "suggestion": "How to fix securely",
      "effort": "LOW|MEDIUM|HIGH"
    }
  ]
}
```

---

#### Agent 7: UX/Ergonomics (`ux`)

```
You are analyzing code changes for UI/UX quality against the project's design system (DESIGN.md).

CHANGES TO ANALYZE:
- Branch: {CURRENT_BRANCH} vs {TRUNK_BRANCH}
- Files: {CHANGED_FILES}

DIFF:
{DIFF_CONTENT}

LOOK FOR:
1. Design token violations (using raw colors instead of --ws-* or --pub-* tokens)
2. Crossing the token boundary (--ws-* used in public surfaces or --pub-* in workspace)
3. Copy that violates DESIGN.md rules (second-person hype, encouragement, apology language)
4. Motion/animation exceeding limits (>160ms duration, non-ease-out easing)
5. Empty state handling that "comments" instead of staying silent (DESIGN.md: silence is a feature)
6. Missing loading/error states
7. Inline styles or ad-hoc components instead of using the atom/molecule library
8. Typography violations (wrong font for context, wrong size for role)
9. Color used for decoration rather than meaning
10. Focus indicators that are too flashy (glow, animation >120ms)

DESIGN SYSTEM RULES:
- Muted archival palette: Parchment #F5F2ED, Oxide Blue #3F5C6E, Charcoal Ink #2E2E2C
- Copy: declarative, not encouraging. "3 fields unfilled" not "You still need to complete..."
- Empty states: fields exist but are blank, labels remain visible, system does not comment
- Motion: 120-160ms, ease-out only. If motion is noticeable, it's indulgent.
- No pure black. No opacity hacks. No centered content blocks.

OUTPUT FORMAT (JSON):
{
  "agent": "ux",
  "findings": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "title": "Brief description",
      "file": "path/to/file.tsx",
      "line": 112,
      "description": "UX issue explanation",
      "user_impact": "How this affects users",
      "suggestion": "Improved UX approach",
      "effort": "LOW|MEDIUM|HIGH"
    }
  ]
}
```

---

#### Agent 8: Review Feedback (`review`) - Only if HAS_PR=true

```
You are analyzing PR review comments to check if they have been addressed in the current diff.

CHANGES TO ANALYZE:
- Branch: {CURRENT_BRANCH} vs {TRUNK_BRANCH}
- PR: {PR_URL} (#{PR_NUMBER})
- Files: {CHANGED_FILES}

DIFF:
{DIFF_CONTENT}

PR REVIEW COMMENTS (inline code comments):
{REVIEW_COMMENTS}

PR REVIEW THREADS (general comments):
{REVIEW_THREADS}

ANALYZE EACH REVIEW COMMENT AND DETERMINE:
1. Is this comment addressed by the current diff?
2. If not addressed, what specific action is needed?
3. Is the comment still relevant or outdated?

CATEGORIZE EACH COMMENT AS:
- RESOLVED: The diff addresses this feedback
- UNRESOLVED: The feedback has NOT been addressed and action is needed
- OUTDATED: The code has changed significantly, making this comment no longer applicable
- QUESTION: The reviewer asked a question that needs a response (not code change)

OUTPUT FORMAT (JSON):
{
  "agent": "review",
  "pr_number": 123,
  "pr_url": "https://github.com/...",
  "findings": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "status": "RESOLVED|UNRESOLVED|OUTDATED|QUESTION",
      "title": "Brief description of the review comment",
      "file": "path/to/file.ts",
      "line": 42,
      "reviewer": "username",
      "original_comment": "The reviewer's original comment",
      "description": "Analysis of whether/how this was addressed",
      "suggestion": "What to do if unresolved",
      "effort": "LOW|MEDIUM|HIGH"
    }
  ],
  "summary": {
    "resolved": 5,
    "unresolved": 2,
    "outdated": 1,
    "questions": 1
  }
}

SEVERITY GUIDE:
- HIGH: Blocking feedback (requested changes, security concerns, bugs identified)
- MEDIUM: Suggestions that should be addressed (code quality, performance)
- LOW: Minor suggestions, style preferences, optional improvements

Only include comments that are actionable or noteworthy. Skip trivial resolved comments like "LGTM" or acknowledgments.
```

---

### Step 3: Collect and Parse Results

Wait for all agents to complete. Parse the JSON output from each agent.

### Step 4: Generate Report

Produce the final report in this format:

```
═══════════════════════════════════════════════════════════════════
 IMPROVE REPORT: {CURRENT_BRANCH} vs {TRUNK_BRANCH}
 Files changed: {count} | Lines added: {added} | Lines removed: {removed}
═══════════════════════════════════════════════════════════════════

[For each agent with findings, render a section:]

┌─ BUGS ({count} findings) ────────────────────────────────────────
│
│ [{SEVERITY}] {title}
│   {file}:{line}
│   {description}
│   Suggestion: {suggestion}
│   Effort: {effort}
│
│ [{SEVERITY}] {title}
│   ...
│
└──────────────────────────────────────────────────────────────────

[Repeat for: SIMPLIFY, PERF, TESTS, DOCS, SECURITY, UX, REVIEW]

[If HAS_PR=true, include special REVIEW section:]

┌─ REVIEW FEEDBACK ({count} findings) ─────────────────────────────
│  PR #{PR_NUMBER}: {PR_URL}
│
│ [{STATUS}] [{SEVERITY}] {title}
│   {file}:{line} (@{reviewer})
│   Original: "{original_comment}"
│   Analysis: {description}
│   Action: {suggestion}
│
└──────────────────────────────────────────────────────────────────

═══════════════════════════════════════════════════════════════════
 SUMMARY
═══════════════════════════════════════════════════════════════════

 Priority Items (High impact + Low effort):
   1. {title} - {file}:{line}
   2. {title} - {file}:{line}
   ...

 Quick Wins (Low effort):
   • {title} ({agent})
   • {title} ({agent})
   ...

 By Category:
   Bugs:     {count} ({high} high, {med} medium, {low} low)
   Simplify: {count} ({high} high, {med} medium, {low} low)
   Perf:     {count} ({high} high, {med} medium, {low} low)
   Tests:    {count} ({high} high, {med} medium, {low} low)
   Docs:     {count} ({high} high, {med} medium, {low} low)
   Security: {count} ({high} high, {med} medium, {low} low)
   UX:       {count} ({high} high, {med} medium, {low} low)

 [If HAS_PR=true:]
 PR Review Status (#{PR_NUMBER}):
   Resolved:   {resolved_count}
   Unresolved: {unresolved_count} ← address these!
   Outdated:   {outdated_count}
   Questions:  {questions_count}

 Total: {total} findings

═══════════════════════════════════════════════════════════════════
```

### Priority Ranking Logic

1. **Priority Items**: HIGH severity + LOW effort (fix these first!)
2. **Quick Wins**: Any severity + LOW effort
3. **Major Work**: HIGH severity + HIGH effort (plan for these)
4. **Nice to Have**: LOW severity + any effort

## Notes

- Only report issues actually present in the diff, not pre-existing issues
- Be specific with file paths and line numbers
- Provide actionable suggestions, not vague advice
- When in doubt about severity, be conservative (prefer MEDIUM over HIGH)
- Empty findings for an agent is fine - don't invent issues
- The review agent only runs when a PR exists for the current branch
- Unresolved review comments should be treated as high priority items
- If `gh` CLI is not authenticated, the review agent will be skipped
