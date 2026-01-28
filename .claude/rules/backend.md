---
paths:
  - "backend/**"
  - "shared/**"
---

# Backend & Database Rules

- All mutations go through **Actions** (user intent) which produce **Events** (observable outcomes)
- **Soft-intrinsic type derivation**: derive action types from relationships, NOT explicit checks
  - Red flags: conditionals on `entityType === 'subtask'`, hardcoded `type: 'Subtask'`, variables named `task`/`subtask` with explicit strings
- Enforce Zod schema validation in `shared/`; derive TS types from Zod schemas
- Tables: snake_case plural; Columns: snake_case; UUIDs: `gen_random_uuid()`
- Backend API (Fastify): camelCase for request/response; Frontend types: snake_case matching DB columns
