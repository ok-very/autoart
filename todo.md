# AutoArt Priorities

*Last Updated: 2026-02-01*

## Bug List

- AutoHelper Settings doesn't link correctly to frontend menu
- Cymatic loader should go seamless pattern/squaretile, slightly heavier line (0.5pt)
- Login fails with demo account credentials - can't test

---

## P0: Blocking

*(none)*

---

## P1: Ready to Build

| # | Issue | Category |
|---|-------|----------|
| — | Autohelper: add auth key handshake between frontend settings and backend | Security |
| 217 | Expose interpretation HTTP routes for frontend hooks | Backend |
| 216 | Derived field: "Last Updated / Last Touched" with Project Log linkage | Feature |
| 235 | Add Context Breadcrumb to Events | Frontend |
| 237 | Performance Optimization & Caching | Backend + Frontend |
| 81 | Enhance Record Inspector Assignee Chip | Feature |
| 79 | Enhance Workflow View Interactions | Feature |
| 82a | User CRUD: create/invite user, set role, reset password | Feature |
| 82b | Project assignment: assign user to project, transfer ownership from demo user | Feature |
| 82c | User deactivation: soft-delete user, reassign owned actions/records | Feature |
| 82d | Upgrade user chip: avatar photo, name, role — used in assignee fields, event log, header | UI |
| 82e | User settings: edit profile, upload avatar photo, change password | Feature |

---

## P2: Near-term

| # | Issue | Category |
|---|-------|----------|
| 173 | Epic: Finance Management System (Invoices + Budgets + Vendor Bills + Reconciliation) | Epic |
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
| 82 | User Account Management: create user via UI, assign to project, deactivate/delete user | Feature |
| 291 | Schema editor / Composer relationship-math builder | Feature |
| — | Action vocabulary: store classification verbs/nouns/adjectives from imports as a heuristic JSONB tree; Composer and command toolbar use vocabulary to interpret what action type is being constructed or referenced | Classification |

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

| # | Issue | PR |
|---|-------|----|
| — | Fix: Methodology→Process, fieldBindings crash, Bound→Linked, LoginPage design tokens | #312 |

---

## Recently Closed

| # | Issue | Closed By |
|---|-------|-----------|
| — | Dockview v4 theme, swoopy tab corners, unified ThemedTab, tab strip + button | PRs #307-311 |
| 275 | Epic: Export Workbench — preview-first outputs + finance via sessions | PRs #286-290, #292 |
| 218 | Phase 6: Remove task_references system + hierarchy nodes | PRs #282-285 |
| — | Polls editor/management surface in dashboard | PRs #271-273 |
| — | Style token infrastructure + formatter consumption | PRs #279-280 |
| — | Chladni-pattern cymatic loading screen | PR #281 |
| — | In-flight doc PRs (git.md merge rules) | PRs #266, #270 |
| — | Font refactor: shared base.css + CSS variable font-family | PRs #260, #262 |
| — | Dockview panels not rendering + Composer defaults to "Task" | PRs #263-265 |
| — | Header reorder, Applications dropdown, Intake cleanup | PRs #267, #269 |
| — | Restore Windows venv scripts | PR #259 |
| 238 | Epic: Invoicerr Integration (invoice management system) | PRs #239-249 |
| 227-234 | Events Module + Project Log (Phases 1-4) | PRs #227-234 |
| 185 | Fork and modernize crab-meet scheduling polls | PRs #186, #206-213 |
| 87 | Global Command Palette | PRs #174, #176 |

---

## Recent Unlanded Work (no issue)

| PRs | Description |
|-----|-------------|
| #214 | Date format + timezone user settings |
| #215 | Restructure .claude/ for Claude Code best practices |
| #205 | Wire theme variables to global styles |
| #204 | Modernize tabs, remove Bound labels (superseded by PRs #307-311) |
| #198, #201 | Design system docs (palette, typography, layout) |
| #189-195 | React Compiler fixes (Tier 1-3) |
| #188 | Add referenceSlots to action arrangements |
