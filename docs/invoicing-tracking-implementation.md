# Finance System Implementation Plan (Stashed)

*Stashed: 2026-01-29 — Resume when ready to build*

## Context

The BFA projector (`backend/src/modules/exports/projectors/bfa-project.projector.ts`) and RTF export system are production-ready but depend on finance data that doesn't exist yet. The projector currently reads budget data from `BUDGET_ALLOCATED` events and project metadata — not from real financial records.

## What Exists Today

- **BFA projector** → RTF export (the boss To-Do document)
- **Financial fact kinds** in event system: `BUDGET_ALLOCATED`, `PAYMENT_RECORDED`, `CONTRACT_EXECUTED`, `INVOICE_PREPARED`
- **CSV interpretation rules** for budget and invoice text patterns (`budget-rules.ts`, `invoice-rules.ts`)
- **Record definition system** with Contact, Location, Material, Document types (no finance types)
- **Export target plugin architecture** (RTF, Google Docs, PDF)

## What's Missing

- Finance-specific record definitions (Invoice, Vendor Bill, Budget, Payment, Expense)
- Computed fields engine (can't do `total = sum(line_items.qty * unit_price)`)
- Finance UI surfaces
- Finance export modules (Invoice PDF, Budget CSV)

## Epic: #173 — Finance Management System

### Dependency Chain

```
Phase 1 — Foundation (parallel, blocks everything)
├── #171  Seed finance RecordDefinitions (Invoice, Vendor Bill, Budget, Payment, Expense)
├── #166  Computed fields + relationship rollups (JsonLogic + decimal.js)
└── #159  Contacts quick-export (client/vendor linking prerequisite)

Phase 2 — Core Features (sequential, depends on Phase 1)
├── #165  Invoice generation + tracking (A/R)
├── #167  Project Budgets surface (stage allocations + reconciliation)
└── #168  Vendor bills + expense tracking (A/P)

Phase 3 — Integration (depends on Phase 2)
├── #169  Finance surfaces + quick overlays (KPI hub)
├── #170  Wire finance actions → Composer + Project Log
└── #172  Finance export modules (Invoice PDF, Budget CSV)
```

### Key Files

| Area | Path |
|------|------|
| BFA Projector | `backend/src/modules/exports/projectors/bfa-project.projector.ts` |
| RTF Target | `backend/src/modules/exports/targets/bfa-rtf-target.ts` |
| RTF Formatter | `backend/src/modules/exports/formatters/rtf-formatter.ts` |
| Budget Rules | `backend/src/modules/interpreter/mappings/budget-rules.ts` |
| Invoice Rules | `backend/src/modules/interpreter/mappings/invoice-rules.ts` |
| Export Schemas | `shared/src/schemas/exports.ts` |
| Domain Events | `shared/src/schemas/domain-events.ts` |
| Record Seeds | `backend/src/db/seeds/001_record_definitions.ts` |
| DB Schema | `backend/src/db/schema.ts` |
| Export Service | `backend/src/modules/exports/exports.service.ts` |

### Phase 1 Starting Point

**#171 (Seed finance RecordDefinitions)** is the first PR — add Invoice, Vendor Bill, Budget, Payment, Expense record definitions following the same pattern as Contact/Location/Material/Document in `001_record_definitions.ts`.

**#166 (Computed fields)** is the largest piece — needs JsonLogic evaluation engine, decimal.js for money math, and relationship rollup queries.

**#159 (Contacts export)** provides the client/vendor linking that invoices and bills depend on.
