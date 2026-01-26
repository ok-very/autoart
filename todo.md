# AutoArt Priorities

*Last Updated: 2026-01-26*

## In Progress

### Narrative Canvas Wiring (#147-150)

| # | Issue | Status |
|---|-------|--------|
| 147 | Overlays: standardize workflows + persistence boundaries | 🔄 In Progress |
| 148 | Mail: wire selection → SelectionInspector + mapping workflows | 🔄 In Progress |
| 149 | SelectionInspector: complete wiring + tab routing | 🔄 In Progress |
| 150 | MappingsPanel: link/unlink actions via overlays | 🔄 In Progress |

**TODO from #147:**
- [ ] Audit current overlay/drawer usage and consolidate patterns
- [ ] Define overlay types for mapping flows (picker, confirm unlink, create-then-link)
- [ ] Ensure transient overlay state not persisted

**TODO from #148:**
- [ ] Mail selection sets `{ type: 'email', id }` and auto-expands inspector
- [ ] Add/verify email inspector renderer
- [ ] Email ↔ record/action linking uses shared overlay flows

**TODO from #149:**
- [ ] Add `inspectEmail(emailId)` helper
- [ ] Wire Mappings tab to render MappingsPanel with correct IDs
- [ ] Navigation from mapping entry updates selection

**TODO from #150:**
- [ ] Add "Link…" button + per-row "Unlink" menu
- [ ] Implement overlay flows: search/pick, confirm unlink, create-then-link
- [ ] Wire mutations and query invalidation

---

## P0: Blocking

| # | Issue | Status |
|---|-------|--------|
| 44 | Google OAuth integration is cosmetic | Open |

---

## P1: Ready to Build

| # | Issue | Category |
|---|-------|----------|
| 87 | Global Command Palette | Feature |
| 81 | Enhance Record Inspector Assignee Chip | Feature |
| 79 | Enhance Workflow View Interactions | Feature |

---

## P2: Near-term

| # | Issue | Category |
|---|-------|----------|
| 83 | Email Ingestion & Comms Tab | Backend + Feature |
| 84 | Email Notices API | Backend |
| 85 | Templating Engine | Feature |
| 86 | Monday.com Board Sync Settings | Integration |
| 82 | User Account Management | Feature |

---

## P3: Long-term / Backlog

| # | Issue | Category |
|---|-------|----------|
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

## Recently Closed

| # | Issue | Closed By |
|---|-------|-----------|
| 151 | Import Step 6 navigation bug | PR #152 |
| 135 | QA: Arrangements rename verification | PR #155 |
| 134 | Roadmap: Arrangements + projection-first | PR #156 |
| 126-133 | Arrangements refactor | PRs #136-141 |
| 68 | Surfaces: header → dockable | panelRegistry complete |
| 65 | SelectionInspector surface | Split into #147-150 |
| 33 | Composer UX | Narrative Canvas #142-146 |

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
