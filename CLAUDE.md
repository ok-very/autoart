# AutoArt Project Instructions

## Operating Principles

**There is no time pressure on this project.** Never rush. Never improvise under error pressure.

When a tool or workflow errors:
1. **STOP.** Do not fall back to manual alternatives.
2. Re-read the relevant CLAUDE.md or skills section.
3. Diagnose why the prescribed tool failed.
4. Fix the tool's state, not the symptom.

Quality and consistency matter more than speed. Check references before acting.

---

## Non-Negotiable Rules

**These rules override all other priorities. Violations waste tokens and break the codebase.**

- Use **stackit** for all branch/PR operations. See `@.claude/skills/git.md` for full reference.
- **NEVER** manually rebase, force push, or retarget stacked branches. Use `stackit restack` / `stackit sync`.
- **NEVER** use `--squash` when merging PRs. Always `--merge`.
- **NEVER** amend pushed commits. Create new commits.
- **Do NOT use Mantine.** Use bespoke atoms/molecules from `ui/atoms/` and `ui/molecules/`.
- **ALWAYS use pnpm catalog** for shared dependencies.

- **NEVER use `git stash`** to work around dirty trees. Commit the changes (even to unrelated files like `todo.md` or build artifacts) so branch switching works cleanly. Stash/pop loops waste tokens and risk data loss.
- **NEVER navigate between stack branches to apply fixes.** If a review comment targets a parent branch, apply the fix on the current (top) branch — it lands in the same merge. Switching branches mid-merge causes dirty-tree errors, restacking, and cascading failures.

---

## Skills Reference

@.claude/skills/git.md - Stackit workflow, merge rules, commit conventions
@.claude/skills/frontend.md - React components, workspace system, UI patterns
@.claude/skills/backend.md - Fastify modules, Action/Event pattern, database
@.claude/skills/project.md - Monorepo structure, commands, nomenclature, coding principles

### Design System

@docs/DESIGN.md - Foundational palette and interaction rules
