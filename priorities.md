# AutoArt Priorities

*Last Updated: 2026-01-25*

## Priority Tiers

### P0: Blocking / Critical Path
Issues that block core workflows or other development.

| # | Issue | Category |
|---|-------|----------|
| 135 | QA: Arrangements rename verification checklist | QA |
| 134 | Roadmap: Arrangements + projection-first workflow | Planning |
| 44 | Google OAuth integration is cosmetic | Bug |
| 151 | Import Step 6 navigates to /projects instead of imported project | Bug |

### P1: Active Development
Currently in progress or next up. Narrative Canvas wiring.

| # | Issue | Category |
|---|-------|----------|
| 150 | MappingsPanel: link/unlink actions via overlays | Narrative Canvas |
| 149 | SelectionInspector: complete wiring + tab routing | Narrative Canvas |
| 148 | Mail: wire selection → SelectionInspector + mapping workflows | Narrative Canvas |
| 147 | Overlays: standardize workflows + persistence boundaries | Narrative Canvas |

### P2: Near-term Features
Ready for implementation when P1 clears.

| # | Issue | Category |
|---|-------|----------|
| 87 | Global Command Palette | Feature |
| 81 | Enhance Record Inspector Assignee Chip | Feature |
| 79 | Enhance Workflow View Interactions | Feature |

### P3: Medium-term
Planned but not urgent. Backend-heavy or dependencies.

| # | Issue | Category |
|---|-------|----------|
| 83 | Email Ingestion & Comms Tab *(backend first, then UI)* | Backend + Feature |
| 84 | Email Notices API *(outbound, needs #85)* | Backend |
| 85 | Templating Engine | Feature |
| 86 | Monday.com Board Sync Settings | Integration |
| 82 | User Account Management | Feature |
| 55 | Automail Phase 4: Testing & Validation | Testing |
| 74 | Import Workbench: Runner + Gemini | Import |

### P4: Long-term / Backlog
Deferred or low priority.

| # | Issue | Category |
|---|-------|----------|
| 118 | Gemini AI: drafts, filenames, contacts | AI |
| 117 | Gemini Vision: deep crawl fallback | AI |
| 66 | Mail surface + popout + mappings | Workspace |
| 64 | Electron SPA shell | Desktop |
| 62 | Multi-window popouts + IPC | Desktop |
| 17 | InDesign data merge CSV export | Export |
| 8 | Documentation + Automation tooling | Tooling |

---

## Recently Closed

| # | Issue | Closed By |
|---|-------|-----------|
| 68 | Surfaces: header → dockable | Complete - panelRegistry has all panels |
| 65 | SelectionInspector surface + mappings | Split into #147-150 |
| 33 | Composer UX | Narrative Canvas PRs #142-146 |

---

## AutoHelper (ok-very/autohelper)

| # | Issue | Priority |
|---|-------|----------|
| 26 | Runner + toasts + Gemini | P3 |
| 25 | PDF import + ref | P3 |
| 12 | Report endpoint | P4 |
| 11 | Intake manifest endpoint | P4 |
| 10 | Snapshot endpoint | P4 |
| 9 | Fetch endpoints | P4 |
