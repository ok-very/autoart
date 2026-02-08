# AutoArt Priorities

*Last Updated: 2026-02-08*
*Strategy: Foundation phases 0-2 complete (see [roadmap.md](roadmap.md) for architectural history). Phase 3 (import pipeline) complete. Phase 4/4B (BFA integration, #437/#438) complete. Phase 5 (Finance Foundation) in review (PRs #456-457). Phase 6 (Finance Surfaces) complete (PRs #460-464). Phase 7 (Platform Polish) next. This file drives active priorities.*

## Bug List

**Active — unphased:**
- **Project binding in workspaces is implementation theater:** Phase 1.2 wired WorkspaceContext consumption, but panels don't actually use the bound project ID. UI shows binding UI, backend may store it, but the connection between "user binds project to workspace" and "panels render that project's data" is broken or never existed. Trace the full path: workspace save → project binding persistence → panel mount → data fetch with bound ID.
- **Theme assignment coupled to workspaces — meaningless complexity:** Each workspace carries its own theme, but themes are undifferentiated (Compact, Minimal, Floating, Default are essentially identical). Per-workspace theme assignment adds complexity without payoff. Either decouple theme selection from workspace identity (global user preference), or differentiate themes first per DESIGN.md variant guidance. Got muddied in during the Phase 1 workspace rewrite.
- **UnifiedComposerBar not rendering on Project page:** Phase 3.6 wired vocabulary suggestions into UnifiedComposerBar, but the bar doesn't appear in the accessibility tree on ProjectPage despite being mounted with `visible={composerBarVisible}` (defaults to true). The legacy ComposerView renders in the Composer nav panel instead. Related to Phase 7 "Composer bar as sleek dockview popout window" item — bar is currently pinned to ProjectPage as fixed-position overlay (wrong place). Needs investigation: why isn't it rendering, and should it be a proper dockview panel first before debugging visibility.
- **Intake form connections UX:** "Form connections to linked" vs "Make new entry" flow is confusing — needs UX review to clarify intent and behavior
- **Image form block link:** No image preview loads in the editor — can't verify via Preview button either (see Phase 0.3). Editor should show inline representation rather than relying on separate preview
- Avisina Broadway test seed data — container seeding + idempotency fixes landed recently, but full chain untested

**Phase 3 review findings (PRs #439-446):**

*Security:*
- **Missing auth on classifications route (PR #439):** `GET /sessions/:id/classifications` has no `preHandler: [app.authenticate]` while `/interpret` and `/reclassify` do. Leaks session classification data to unauthenticated callers.
- **Missing auth on action-links read route (PR #443):** `GET /action-links/:actionId` unauthenticated while `POST /link-action` requires auth. Allows enumeration of import session/item associations.

*Logic bugs:*
- **Vocabulary upsert NULL adjective duplicates (PR #441):** PostgreSQL unique constraints allow multiple NULL rows in the `adjective` column — repeated vocabulary entries without adjective create duplicates instead of incrementing `frequency`. Fix: normalize missing adjective to empty string before insert.
- **`/link-action` 500 on duplicate (PR #443):** No `onConflict` handling — auto-link then manual link for same `(session, item, action)` triple hits unique constraint and returns 500. Should upsert or return existing row.
- **Classification cache hash ignores definition schema (PR #445):** `deriveContentHash()` only hashes `def.id` + `def.name`. Schema changes (field edits, constraint updates) don't invalidate cache → stale classifications served for up to 1 hour. Fix: hash full definition or include `updatedAt`.
- **`useLinkAction` wrong response type (PR #444):** Hook declares `api.post<ActionLinksResponse>` (array wrapper) but backend returns single link object. Latent type mismatch — no current consumer reads `.data`, but will break if anyone does.
- **`entityType` cast bypasses validation (PR #439):** `InterpretItemRequestSchema` accepts `z.string().optional()` for `entityType` then asserts to `ImportPlanItem['entityType']` union — any string passes through without runtime check.

*Visual/UX:*
- **Double border in Fields panel (PR #440):** Both sidebar wrapper (`FieldsPanel.tsx:72`) and `FieldsMillerColumnsView` root add `border-r border-ws-panel-border` — double divider line.
- **Actions sidebar shows record stats (PR #440):** "All Actions" row displays `useRecordStats()` total which only counts `DataRecord` instances. Per-definition rows always show "0 instances". Should hide counts or use action-specific stats for non-record kinds.
- **ImportLinkDialog available count mismatch (PR #444):** Header shows "Items (X available)" filtering linked items, but list renders all items including linked ones.

**Deferred:**
- AutoHelper sessions lost on backend restart (#340) — link key IS persisted in `connection_credentials` DB table. Issue is tray icon staleness — needs design decision, not a bugfix.

**UX polish:**
- "Import" tab hides in overflow menu despite ample space in tab bar
- "Select project" dropdown in header: conditional on `hasBoundPanels` (intentional), but position between nav links feels wrong — remove the feature
- Emoji/icon selector overlay — search doesn't work; consider switching to Phosphor Icons
- Placeholder themes: Compact, Minimal, Floating, and Default still essentially identical — differentiate per DESIGN.md theme variant guidance. Glass and neumorphic variants pending implementation (see Housekeeping).
- Project View: "New project" dropdown UI broken under "Your projects" section — formatting not clean

**Confirmed resolved (50+ items):** See Recently Closed section for PR references.

---

## Completed Phases (3–4B)

- **Phase 3: Import Pipeline** ✓ — PRs #439-446. Interpretation routes, registry UI, vocabulary, workflow interactions, performance/caching.
- **Phase 4: BFA Reconciliation** (#437) ✓ — PRs #448-455. Program config, sync differ, reconciliation service + panel, Google Docs injection.
- **Phase 4B: BFA Import** (#438) ✓ — PRs #452-455. Schema transform, Composer integration, frontend import toggle.

---

## Phase 5: Finance Foundation

*Stand up the data layer for the Finance epic (#173). Seed definitions first, then computed fields, then records. No UI surfaces yet -- this phase is backend + shared.*

**Previously Phase 4.** Renumbered to accommodate BFA integration. Independent of Phase 4/4B -- can run in parallel.

**Status:** In progress — PR #456/#457 awaiting review (formula engine migration + Invoice paid_amount/balance_due fields).

**Scope:**

| # | Issue | Category | Status |
|---|-------|----------|--------|
| 171 | Seed: Finance RecordDefinitions (Invoice, Vendor Bill, Budget, Payment, Expense) | Finance | ✓ Done (#171 merged earlier) |
| 166 | Computed fields + relationship rollups (no-scripting, budgets/invoices/stage sums) | Finance | In review (PRs #456-457) |
| 165 | Invoice generation + tracking (records + PDF export + payments) | Finance | Partial (data layer done) |
| 168 | Vendor bills + expense tracking (invoice receipts, payments, stage reconciliation) | Finance | |
| 167 | Project Budgets surface (stage allocations + reconciliation rollups + spreadsheet export) | Finance | |

**Dependencies:** #171 (seed) landed. #166 (computed fields) in review — unblocks #165, #167, #168 by providing the rollup mechanism.

**Internal order:** #171 ✓ -> #166 (in review) -> (#165, #167, #168 can parallelize)

**Done when:** Finance record definitions seed correctly through Composer ✓, computed fields derive budget/invoice/expense totals (in review), and invoice/bill/budget records can be created and queried via API.

---

## Phase 6: Finance Surfaces & Integration ✓

**Status: Complete** — All items merged via PRs #460-464 (Feb 8, 2026).

*Wire finance data into the UI, Composer event log, and export pipeline. Depends on Phase 5 data layer being solid.*

**Previously Phase 5.** Renumbered.

**Scope:**

| # | Issue | Category | Status |
|---|-------|----------|--------|
| 169 | Finance surfaces + quick overlays (budgets/invoices/expenses hub) | Finance | ✓ Done (PR #461) |
| 170 | Wire finance actions into Composer + Project Log (invoice/bill/payment events) | Finance | ✓ Done (PR #460) |
| 172 | Finance export modules (Invoice PDF, Budget CSV, export presets) | Finance | ✓ Done (PR #462) |
| 393 | File Detection & Alignment Service with watchdog (scoped: AutoHelper invoice watchdog) | AutoHelper | ✓ Done (PR #464) |
| 183 | Evolve export into live client reports system | Reports | Deferred |
| 291 | Schema editor / Composer relationship-math builder | Feature | Deferred |

**Dependencies:** Phase 5 complete. #170 (Composer wiring) should land before #169 (surfaces) so the UI can show real events. #172 (exports) depends on #165 (invoices) and #167 (budgets) from Phase 5.

**Done when:** Users can create invoices/budgets/expenses from the UI, see finance events in the Project Log, export Invoice PDFs and Budget CSVs, and the client reports system serves live data.

**Key deliverables:**
- Finance events + narrative renderer + invoice number validation endpoint (PR #460)
- Finance overlay views (CreateExpenseView, AllocateBudgetView, CreateBillView) + surface polish (PR #461)
- Handlebars invoice template refactor + preview endpoint + InvoicePreviewView UI (PR #462)
- AutoHelper invoice watchdog module - filesystem watching, file path enforcement, disk validation (PR #464, side-chain)
- Bug fix: invoice validation race condition (PR #463)

---

## Phase 7: Platform Polish & Integrations

*Independent improvements that do not gate each other. Work from this phase in any order as bandwidth allows.*

**Previously Phase 6.** Renumbered.

**Workspace polish:**

| # | Issue | Category |
|---|-------|----------|
| 216 | Derived field: "Last Updated / Last Touched" with Project Log linkage | Feature |
| 81 | Enhance Record Inspector Assignee Chip | Feature |
| -- | Composer bar as sleek dockview popout window (replace modal) | UX |
| -- | Consolidate Calendar/Gantt/future view expansions: link Application views to Project View segmented equivalents; cross-project filter/overlay | Feature |
| -- | Poll editor: support different/multiple time block selections per day | Polls |

**Intake & records:**

| # | Issue | Category |
|---|-------|----------|
| -- | Intake forms -> records verification: E2E test block mapping, record creation, completion flow | Intake |
| 178 | Manual file link support in intake forms | Intake |
| 177 | Integrate intake forms with records system | Intake |

**Integrations & services:**

| # | Issue | Category |
|---|-------|----------|
| 159 | Contacts quick-export overlay (vCard, recipient formats) | Feature |
| 84 | Email Notices API | Backend |
| 85 | Templating Engine | Feature |
| 86 | Monday.com Board Sync Settings | Integration |
| -- | **AutoHelper local-only config:** Roots, DB path, garbage collection settings should be stored locally with AutoHelper, not in global DB | AutoHelper |
| -- | **AutoHelper "Rebuild Index" is theater:** Carries stale DB path, hangs when triggered -- needs real backend handler or correct path | AutoHelper |

**Note:** AutoHelper settings bridge (was P2) is **resolved** -- frontend now correctly uses backend bridge endpoints. See [roadmap.md](roadmap.md#autohelper-status-resolved).

**Note:** Workspace issues #179-182 closed on GitHub -- absorbed into Phase 1 (PRs #421-429).

---

## Housekeeping

| File | Issue | Phase |
|------|-------|-------|
| Records view | Align layout with Fields view: definitions filter + search bar, no redundant dropdown title | — |
| `packages/ui/src/molecules/SegmentedControl.tsx` | Implement glass theme (plus remove it from the non-glass theme); also add neumorphic theme for funsies | — |
| Parchment theme | Text color bleeding into forms (`--pub-*` inheriting `--ws-*` parchment colors); Serif 4 not applied to workspace at all yet — only shows up in forms (ironic). Add moderate Serif 4 usage to parchment theme per DESIGN.md | — |
| Intake forms + poll deployments | Need verification: localhost vs production endpoint config | — |
| Future outbound subdomains | `polls.autoart.work`, `forms.autoart.work` endpoint routing not wired | — |
| SelectionInspector / Record view | Handle `definition_kind` system for filtering/classification — resolver exists but inspector doesn't use it yet | — |
| Record fields | Full RichTextEditor with combobox used where simpler field types are appropriate | — |
| Selection editor | "Plan" link badge system could just be a pointer to the active window name / binding group color | — |
| `UniversalTableCore.tsx` + composites | All tables div-based with `role` attributes — migrate to Table atom primitives from PR #350 | — |
| `packages/ui/src/atoms/Badge.tsx` | Badge variant colors use domain-semantic Tailwind colors — needs separate approach (not chrome tokens) | — |
| `frontend/src/ui/sidebars/` + definition filtering | `definition_kind = 'container'` — type declared and filtered but no distinct UI treatment (icon, section, color) | — |
| `ExportMenu.tsx` | `invoiceNumber` sent to PDF/DOCX endpoints — backend should consume for Content-Disposition filenames |
| `vocabulary.routes.ts` | Whitespace-only prefix passes `z.string().min(1)` — add `.trim()` before `.min(1)` (PR #441) |
| `vocabulary` migration 004 | Composite btree index on `(verb, noun)` won't be used for `ILIKE ... OR ILIKE` prefix queries — consider separate `text_pattern_ops` indexes per column (PR #441) |
| `classification-cache.ts` | Hash truncated to 16 hex chars (64-bit) — collision = wrong result served, not a miss. Use full hash or 32+ chars (PR #445) |
| `todo.md` | Broken anchor `#autohelper-status-resolved` — roadmap heading changed to "AutoHelper Status (Resolved, Evolving)" (PR #442) | — |

**Low priority (CodeAnt #332 nitpicks):**

| File | Issue |
|------|-------|
| `packages/ui/src/atoms/Card.tsx` | Tailwind arbitrary value parsing: `theme(...)` nested inside `var(...)` fallback may be dropped by some JIT parsers |
| `frontend/src/ui/sidebars/ProjectSidebar.tsx` | Section headings (`<p>` at lines 78, 138) lack proper heading semantics for assistive tech |
| `frontend/src/intake/components/blocks/*.tsx` | Email, Phone, Time inputs missing ARIA attributes (`aria-invalid`, `aria-describedby`, `aria-required`) |

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

## In-Flight (Awaiting Review)

| PRs | Description |
|-----|-------------|
| #456-457 | **Phase 5: Finance Foundation (partial — computed fields):** (PR #456) Migrate formula engine from custom tokenizer/parser to `json-logic-js` — 452-line custom parser replaced with JsonLogic evaluation, new API `evaluateFormula(rule, data)` + `buildFormulaData()`, converted all 4 seed formulas (Invoice total, Line Item line_total/line_tax, Budget remaining) to JsonLogic objects, 37 unit tests (28 formula engine + 9 rollup engine). (PR #457) Invoice `paid_amount` rollup (sum of linked payment records) + `balance_due` computed field (total - paid_amount), full rollup chain: line items → subtotal/tax_total → total → paid_amount → balance_due. |
| #460-464 | **Phase 6: Finance Surfaces & Integration:** (PR #460) Wire finance events into Composer + narrative renderer + invoice number validation endpoint. (PR #461) Finance overlay views (CreateExpenseView, AllocateBudgetView, CreateBillView) + surface polish (InvoiceListView balance_due column, FinanceKPIStrip totals, CreateInvoiceView validation). (PR #462) Handlebars invoice template refactor (replaced 340-line string interpolation with compiled template) + preview endpoint (`GET /exports/finance/invoice/:id/preview`) + InvoicePreviewView UI (iframe srcdoc, page preset selector, Print button). (PR #464) AutoHelper invoice watchdog module (filesystem watching, file path enforcement, disk validation) — side-chain. (PR #463) Bug fix: invoice validation race condition (stale async responses overwriting newer state). |

---

## Recently Closed

| # | Issue | Closed By |
|---|-------|-----------|
| 169, 170, 172, 393 | **Phase 6: Finance Surfaces & Integration (Feb 8 2026):** (PR #460) Wire finance events into Composer — `finance-events.service.ts` emitters called from record creation hooks, `finance-narrative.ts` renderer ("Invoice #1023 prepared for $8,500.00"), `/records/validate-invoice-number` endpoint (uniqueness + format validation). (PR #461) Finance overlay views — `CreateExpenseView.tsx`, `AllocateBudgetView.tsx`, `CreateBillView.tsx` registered in OverlayRegistry; surface polish: InvoiceListView balance_due/paid_amount columns, FinanceKPIStrip total balance_due, CreateInvoiceView validation UI. (PR #462) Handlebars invoice template — replaced 340-line string interpolation with compiled Handlebars template (helpers: formatCents, statusClass, eq, gt), preview endpoint `GET /exports/finance/invoice/:id/preview` returns InvoiceExportModel JSON, `InvoicePreviewView.tsx` renders client-side HTML in iframe srcdoc with Print button. (PR #464) AutoHelper invoice watchdog — filesystem watching via `watchdog` library, file path enforcement (invoices/bills/receipts dirs), disk validation endpoint `GET /invoice-watch/validate-number`, bidirectional watch (outgoing exports + incoming vendor bills), report events via heartbeat. (PR #463) Bug fix: invoice validation race condition — `validationVersionRef` counter discards stale async responses. | PRs #460-464 |
| 438 | **Phase 4B: BFA Import to AutoArt Records (Feb 8 2026):** (4B.1) Schema transformation layer — BFA → AutoArt hierarchy/records mapping via `bfa-import.service.ts`, Phase expansion (Stage → Phase nodes), UID-based deduplication, contact uniqueName collision fix (include role in uniqueName). (4B.2) Composer integration — import service orchestrates actions → events flow, creates project lattice (Project → Process → Phase), links contacts/milestones/artists, entity→project resolution via recursive CTE. (4B.3) Frontend import toggle — checkbox in ReconciliationPanel, preview modal, result modal with project links. Review fixes: deduplicated entity resolution (consolidated three near-identical functions), batch ancestor walks (O(N*D) → single CTE with depth guard), return documentUrl in no-headers path, clear localStorage on empty doc ID. | PRs #452-455 |
| 437 | **Phase 4: BFA Reconciliation Pipeline Integration (Feb 8 2026):** (4.1) BFA program configuration — shared Zod schemas (`bfa.ts`: phases, authority, diff report, column mappings), TypeScript code-as-config (`bfa-program.config.ts`: phase canonicalization, budget normalization, regression detection, column mappings, state priority). (4.2) BFA sync differ — pure diff engine (`bfa-sync-differ.ts`) comparing Monday import plan items against local entity snapshots via `external_source_mappings`; orchestration service (`bfa-sync.service.ts`) fetching Monday data, building `LocalEntitySnapshot` from `actions.field_bindings` and `hierarchy_nodes.metadata`; HTTP routes (`bfa-sync.routes.ts`) at `/api/programs/bfa/sync`. (4.3) Backend reconciliation service — migration 007 adds `last_diff_report` JSONB to `monday_sync_states`, sync decisions table, apply logic, rollup handling. (4.4) Frontend reconciliation panel — diff review UI, accept/reject controls, summary stats. (4.5) Google Docs injection — Phase expansion import transformer, entity→project resolution, Docs API integration, styled content injection. | PRs #448-451, #453-455 |
| — | **Phase 3: Import Pipeline (Feb 8 2026):** Interpretation routes, registry UI, vocabulary, workflow interactions, performance/caching | PRs #439-446 |
| — | **Phases 0-2 + bug fixes (Feb 7-8 2026):** Workspace foundation (PRs #416-429), entity kind resolver (PRs #430-431), import wizard fixes (PRs #432-435), OAuth (PR #403), plugin integration (PR #405) | PRs #403-435 |
| — | **Pre-Phase 0 (Jan-Feb 2026):** OAuth unification (PRs #388-392), AutoHelper pairing (PRs #354-368), email redesign (PRs #346-353), user profiles (PRs #341-345), UX polish + token migrations (PRs #307-339) | PRs #307-392 |
| *(older entries pruned — see git log for PRs #174-306)* | | |

---

## Recent Unlanded Work (no issue)

| PRs | Description |
|-----|-------------|
| #214 | Date format + timezone user settings |
| #215 | Restructure .claude/ for Claude Code best practices |
| #198, #201 | Design system docs (palette, typography, layout) |
| #188 | Add referenceSlots to action arrangements |

*Pruned: #204 (superseded by #307-311), #205 (superseded by token migration work), #189-195 (Phase 0.1 addressed React Compiler issues)*
