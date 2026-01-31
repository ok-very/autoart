# AutoArt Priorities

*Last Updated: 2026-01-31*

## P0: Blocking

| # | Issue | Category |
|---|-------|----------|
| — | Dockview panels not rendering — black bar below header, missing panel frames | Bug (critical) |
| — | Composer/Action Creator still defaults to "Task" type — regression from arrangements refactor | Bug (regression) |

---

## P1: Ready to Build

| # | Issue | Category |
|---|-------|----------|
| — | Intake: redundant Create Form / New Form button | Bug |
| — | Intake: "relation intake_forms doesn't exist" DB error | Bug |
| — | Header: "Project" button non-functional, should sit left of workspaces | Bug |
| — | Header: settings icon missing | Bug |
| — | Restructure workspace menu: Collect → Intake; add Applications dropdown (Polls, Forms, Mail, Finances) | UX |
| — | Autohelper: add auth key handshake between frontend settings and backend | Security |
| 218 | Phase 6: Remove task_references system + hierarchy nodes | Refactor |
| 217 | Expose interpretation HTTP routes for frontend hooks | Backend |
| 216 | Derived field: "Last Updated / Last Touched" with Project Log linkage | Feature |
| 235 | Add Context Breadcrumb to Events | Frontend |
| 237 | Performance Optimization & Caching | Backend + Frontend |
| 81 | Enhance Record Inspector Assignee Chip | Feature |
| 79 | Enhance Workflow View Interactions | Feature |

---

## P2: Near-term

| # | Issue | Category |
|---|-------|----------|
| 181 | Fix workspace preset timing (pendingPanelPositions) | Bug |
| 182 | Workspace modification tracking and save workflow | Workspace |
| 180 | Add route/project context to workspace system | Workspace |
| 179 | Context-driven automatic panel reconciliation | Workspace |
| 183 | Evolve export into live client reports system | Reports |
| 178 | Manual file link support in intake forms | Intake |
| 177 | Integrate intake forms with records system | Intake |
| 159 | Contacts quick-export overlay (vCard, recipient formats) | Feature |
| 83 | Email Ingestion & Comms Tab | Backend + Feature |
| 84 | Email Notices API | Backend |
| 85 | Templating Engine | Feature |
| 86 | Monday.com Board Sync Settings | Integration |
| 82 | User Account Management | Feature |

---

## P3: Long-term / Backlog

| # | Issue | Category |
|---|-------|----------|
| 184 | Q1 2026 Roadmap: Workspace System & Client Reports | Roadmap |
| 118 | Gemini AI: drafts, filenames, contacts | AI |
| 117 | Gemini Vision: deep crawl fallback | AI |
| 74 | Import Workbench: Runner + Gemini | Import |
| 66 | Mail surface + popout + mappings | Workspace |
| 64 | Electron SPA shell | Desktop |
| 62 | Multi-window popouts + IPC | Desktop |
| 55 | Automail Phase 4: Testing | Testing |
| 17 | InDesign data merge CSV export | Export |
| 8 | Documentation + Automation tooling | Tooling |

---

## In-Flight (Awaiting Review)

| PR | Description |
|----|-------------|
| #261 | refactor: replace hardcoded font-family with CSS variables |
| #260 | refactor: extract shared font base.css for all three builds |

---

## Recently Closed

| # | Issue | Closed By |
|---|-------|-----------|
| — | Restore Windows venv scripts | PR #259 |
| — | Streamline CLAUDE.md | PR #257 |
| — | Autohelper platform detection + review fixes | PRs #255, #256 |
| — | Resolve all frontend and mail type errors | PR #250 |
| — | Resolve all 92 backend ESLint errors | PR #252 |
| 238 | Epic: Invoicerr Integration (invoice management system) | PRs #239-249 |
| — | Architecture docs update (Jan 2026) | PR #236 |
| — | BFA projector deep query + RTF formatter fidelity + section alignment | PRs #224-226 |
| — | Wire ActionsPanel to open ComposerPanel | PR #220 |
| 227-234 | Events Module + Project Log (Phases 1-4) | PRs #227-234 |
| 44 | Google OAuth integration is cosmetic | PRs #221-223 |
| 185 | Fork and modernize crab-meet scheduling polls | PRs #186, #206-213 |
| 193 | Polls UI: migrate to @autoart/ui primitives | PR #207 |
| 111-113 | Time/calendar features (duration sidechain, working-days, hot zones) | Closed 2026-01-25 |
| 87 | Global Command Palette | PRs #174, #176 |

---

## Recent Unlanded Work (no issue)

| PRs | Description |
|-----|-------------|
| #214 | Date format + timezone user settings |
| #215 | Restructure .claude/ for Claude Code best practices |
| #205 | Wire theme variables to global styles |
| #204 | Modernize tabs, remove Bound labels |
| #198, #201 | Design system docs (palette, typography, layout) |
| #189-195 | React Compiler fixes (Tier 1-3) |
| #188 | Add referenceSlots to action arrangements |
