# AutoHelper Priorities

*Last Updated: 2026-03-04*

**Direction:** AutoHelper is the purpose-built companion to ClickUp. ClickUp is the PM system of record (gantt, timelines, task management). AutoHelper reads from ClickUp to build the lexicon, owns local data (contacts, artists, context), and syncs bidirectionally where AutoHelper is the authority for certain entity types. AutoArt sheds redundant features that now live in ClickUp.

---

## P0: ClickUp Integration — Finish & Test

| # | Item | Status |
|---|------|--------|
| 1 | **API key testing:** Configure real ClickUp token, hit `/clickup/validate`, confirm workspace discovery | Not started |
| 2 | **Template sync dry-run:** Run BFA template sync against real ClickUp list, verify 102-task creation/diff | Not started |
| 3 | **Manifest execution test:** Push a small manifest through `execute_manifest`, confirm parent resolution and custom fields land correctly | Not started |
| 4 | **Hardcoded email template path:** `email_templates.py` uses `C:\Users\Neal\dev\BFA-migration\Email Templates\batched` — make configurable via manifest setting with fallback to `data/email_templates/` | Not started |
| 5 | **Backend bridge schema sync:** `autohelper.routes.ts` SettingsUpdateSchema doesn't include ClickUp fields — add them so web frontend settings passthrough works | Not started |

## P1: ClickUp Read-Side — Lexicon & Sync

The write-side (push tasks into ClickUp) is built. The read-side is not. The client has `tasks.list_all`, `tasks.get`, `spaces.list`, etc. — the API surface exists but nothing consumes it yet.

| # | Item | Status |
|---|------|--------|
| 1 | **Task reader service:** Periodic pull of ClickUp task data (statuses, custom fields, assignments, dates) into AutoHelper's local store. ClickUp is a "postgres-priced database" — read everything useful | Not started |
| 2 | **Contact sync (bidirectional):** Contacts maintained locally by AutoHelper, searchable without ClickUp, but reflected in ClickUp for PMs. AutoHelper is the authority | Contacts module exists, ClickUp sync not wired |
| 3 | **Lexicon enrichment:** Feed ClickUp project/task/field data into the lexicon builder — developer names, project names, status vocabularies, custom field options | Not started |
| 4 | **Artist data sync:** Artists maintained by AutoHelper, available in ClickUp. Same authority pattern as contacts | Artists module exists, ClickUp sync not wired |

## P2: AutoHelper Platform Hardening

| # | Item | Status |
|---|------|--------|
| 1 | **Monday context layer cleanup:** `ContextService._init_clients()` never initializes Monday client, no `monday_api_token` in Settings. Either re-wire (if Monday still used for context) or remove dead code | Dead code flagged |
| 2 | **AutoHelperSection.tsx rewrite:** Consume `GET /config/schema` dynamically instead of hardcoded cards — ClickUp settings may not render in AutoArt web frontend | P1 from old todo |
| 3 | **Settings bridge generalization:** Make backend bridge schema-agnostic (forwards whatever manifest declares) instead of hardcoded Zod schemas per field | Enhancement over P0 #5 |
| 4 | **Collector settings formalization:** `crawl_depth`, image dimension/filesize constraints — add to Settings class and manifest | Carried from old todo |

## P3: AutoArt Redundancy Reduction

As ClickUp takes over PM features, identify and shed redundant AutoArt implementations:
- Import wizard (Monday connector path) — ClickUp connector on backend stays, Monday import path deprioritized
- Gantt/timeline views — read from ClickUp, don't reimplement
- Task management UI — ClickUp handles this

---

## Housekeeping

| Item | Notes |
|------|-------|
| `connections.routes.ts` `/connections/autohelper/credentials` returns Monday token — dead code | Remove |
| `context/autoart.py` `get_monday_token()` — dead code | Remove |
| `context/service.py` direct Monday client init — dead code | Remove |

---

*Previous AutoArt priorities archived to `todo.archived.md`*
