# Action Vocabulary System

*Implementation Plan — February 2026*

## Done Sentence

An agent or human can type freeform text into a single input bar, and the system resolves intent, entities, and field values without an LLM in the hot path.

---

## Problem

The Composer and command bar currently require users to know the UI — pick a type from a dropdown, search for an entity, fill fields manually. Agents face the same friction: they need full schema definitions (token-heavy) or trial-and-error to construct valid actions.

The vocabulary system provides compressed semantic context that powers:
1. **Agent efficiency** — query vocabulary once, cache it, construct valid payloads without loading full schemas
2. **Human efficiency** — type `invoice henderson 5000`, get a pre-filled creation form

The autocomplete is a derived benefit of building agent-first infrastructure.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Input Sources                           │
├─────────────────────────────────────────────────────────────┤
│  • Single text input bar (Composer / Command bar)           │
│  • MCP tool call                                            │
│  • API request                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Parse Endpoint                           │
│                   POST /api/parse                           │
├─────────────────────────────────────────────────────────────┤
│  1. Tokenize input                                          │
│  2. Vocabulary lookup (local, fast)                         │
│  3. Intent detection (pattern matching)                     │
│  4. Entity resolution (search API)                          │
│  5. Field inference                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Creation Router                           │
│            POST /api/actions/resolve-creation               │
├─────────────────────────────────────────────────────────────┤
│  • Determines creation mode (instance / clone / derive)     │
│  • Resolves definition to use                               │
│  • Suggests field values from context                       │
│  • Returns creation plan (not executed)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Consumers                              │
├─────────────────────────────────────────────────────────────┤
│  • Composer UI (preview → confirm → execute)                │
│  • Agent (execute directly or ask for confirmation)         │
│  • Command bar (quick actions)                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Vocabulary Snapshot

Stored in `vocabulary_snapshots` table. Rebuilt on schema changes or import completion.

```typescript
interface VocabularySnapshot {
  version: string;              // semver, bumped on rebuild
  generated_at: string;         // ISO timestamp

  // Action type mappings
  action_types: ActionTypeEntry[];

  // Intent signal words
  signals: {
    create: string[];           // ["new", "create", "add"]
    clone: string[];            // ["like", "copy", "from", "same as"]
    search: string[];           // ["find", "show", "list", "?"]
    child: string[];            // ["add to", "under", "in"]
  };

  // Learned term → entity mappings (from imports)
  term_associations: TermAssociation[];

  // Field inference patterns
  field_patterns: FieldPattern[];

  // Nomenclature aliases
  aliases: Record<string, string>;  // "client" → "contact"
}

interface ActionTypeEntry {
  id: string;
  canonical_name: string;       // "Invoice", "Deliverable"
  verbs: string[];              // ["invoice", "bill", "charge"]
  creation_mode: 'instance' | 'container';
  allows_children: boolean;
  child_type_hint: string | null;
  typical_fields: string[];     // most-used fields, not exhaustive
  parent_context: string | null; // "Finance", "Project"
}

interface TermAssociation {
  term: string;                 // "deliverable"
  maps_to: string;              // action_type_id, field_id, or entity_type
  target_type: 'action_type' | 'field' | 'entity_type';
  confidence: number;           // 0-1, from import frequency
  source: 'import' | 'manual';
}

interface FieldPattern {
  action_type_id: string;
  pattern: 'numeric' | 'date' | 'email' | 'name' | 'currency';
  likely_field: string;
  confidence: number;
}
```

**Token budget:** Snapshot must serialize to < 500 tokens. This forces compression — only high-signal data survives.

### Database Schema

```sql
CREATE TABLE vocabulary_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_vocabulary_active ON vocabulary_snapshots (is_active) WHERE is_active = TRUE;
```

Only one snapshot is active at a time. History kept for drift detection and rollback.

---

## Intent Patterns

The parse endpoint uses pattern matching against vocabulary signals:

| Input Pattern | Intent | Route |
|---------------|--------|-------|
| `{action_type} {entity} {values...}` | create | Creation router |
| `{signal:create} {action_type} ...` | create | Creation router |
| `{signal:clone} {entity} {action_type}` | clone | Search → Clone picker |
| `{entity} {action_type}s` (plural) | search | Search API |
| `{signal:child} {action_type} {signal:child} {entity}` | create_child | Creation router (with parent) |
| `{signal:search} {terms}` | search | Search API |
| `{entity}` (alone) | query | Read API |

**Examples:**

| Input | Parsed Intent |
|-------|---------------|
| `invoice henderson 5000` | create Invoice, contact=Henderson, amount=5000 |
| `new deliverable` | create Deliverable |
| `like morrison invoice` | clone, search Morrison invoices |
| `henderson invoices` | search Invoices where contact=Henderson |
| `add task to henderson project` | create_child, parent=Henderson Project |
| `henderson` | query Henderson (show details) |

---

## Creation Modes

The Creation Router determines how to create based on context:

| Mode | Trigger | Behavior |
|------|---------|----------|
| **instance** | Action type with `creation_mode: 'instance'` | New Action using definition's field bindings |
| **clone** | "like" signal + entity reference | Copy existing Action's field values |
| **derive** | Parent context provided | Type emerges from `parent_action_id` relationship |
| **definition** | "new type" signal or unrecognized noun | Schema modification (admin only) |

The vocabulary signals the first mode. The router handles all four.

---

## API Contracts

### GET /api/vocabulary

Returns current vocabulary snapshot. Supports cache validation.

```typescript
// Request
GET /api/vocabulary
  ?version=1.2.3  // optional, returns 304 if current

// Response
{
  snapshot: VocabularySnapshot,
  cache_until: string  // ISO timestamp, typically 5 minutes
}

// Cache hit response
HTTP 304 Not Modified
```

### GET /api/vocabulary/version

Lightweight version check for cache validation.

```typescript
// Response
{
  version: "1.2.3",
  generated_at: "2026-02-04T10:30:00Z"
}
```

### POST /api/parse

Parse freeform input into structured intent.

```typescript
// Request
{
  input: "invoice henderson 5000",
  context: {
    project_id?: string,
    parent_action_id?: string
  }
}

// Response
{
  intent: "create" | "clone" | "search" | "query" | "unknown",
  confidence: number,  // 0-1
  parsed: {
    action_type?: { id: string, name: string },
    entities: Array<{
      term: string,
      resolved?: { type: string, id: string, label: string },
      unresolved?: true
    }>,
    field_values: Array<{
      field: string,
      value: unknown,
      inferred: boolean
    }>
  },
  suggestions?: Array<{
    intent: string,
    description: string,
    confidence: number
  }>
}
```

### POST /api/actions/resolve-creation

Given parsed intent, return a creation plan.

```typescript
// Request
{
  action_type_id: string,
  context: {
    project_id?: string,
    parent_action_id?: string
  },
  field_values?: Record<string, unknown>,
  clone_source_id?: string  // for clone mode
}

// Response
{
  mode: "instance" | "clone" | "derive",
  definition_id: string,
  suggested_fields: Record<string, unknown>,
  required_fields: string[],
  clone_source?: { id: string, label: string },
  warnings?: string[]
}
```

### MCP Tool

```typescript
{
  name: "get_vocabulary",
  description: "Returns compressed domain vocabulary for action construction and entity classification. Cache the result and pass version on subsequent calls.",
  input_schema: {
    type: "object",
    properties: {
      version: {
        type: "string",
        description: "Current cached version. Returns null body if unchanged."
      }
    }
  }
}

{
  name: "parse_intent",
  description: "Parse natural language input into structured action intent.",
  input_schema: {
    type: "object",
    properties: {
      input: { type: "string", description: "Freeform text input" },
      project_id: { type: "string", description: "Optional project context" },
      parent_action_id: { type: "string", description: "Optional parent for child creation" }
    },
    required: ["input"]
  }
}
```

---

## Vocabulary Builder

### Rebuild Triggers

1. **Schema migration** — action definitions, field definitions changed
2. **Import completion** — new term associations learned
3. **Manual edit** — admin updates aliases or signals
4. **Scheduled** — daily rebuild to prune stale associations

### Build Process

```
1. Load action definitions with definition_kind
   └── Extract canonical names, infer verbs from names

2. Load field definitions
   └── Identify typical_fields per action type (by binding frequency)

3. Query import logs (last 90 days)
   └── Extract term → entity mappings above confidence threshold (0.6)
   └── Aggregate by frequency, cap at top 100 associations

4. Load manual overrides (aliases, signal words)

5. Merge and deduplicate

6. Prune to token budget
   └── Drop low-confidence associations first
   └── Keep all action_types (core)
   └── Keep top N term_associations by frequency × confidence

7. Compute version hash (content-based, not sequential)

8. Write snapshot, mark as active, deactivate previous
```

### Verb Inference

Action type verbs are inferred from canonical names:

| Canonical Name | Inferred Verbs |
|----------------|----------------|
| Invoice | invoice, bill |
| Deliverable | deliver |
| Payment | pay |
| Task | task |
| Note | note |

Plus manual overrides for non-obvious mappings.

---

## Implementation Phases

### Phase 1: Static Vocabulary

**Scope:** Schema-derived vocabulary only. No import learning.

**Deliverables:**
- [ ] `vocabulary_snapshots` migration
- [ ] Vocabulary builder (schema-only)
- [ ] `GET /api/vocabulary` endpoint
- [ ] `GET /api/vocabulary/version` endpoint
- [ ] Rebuild trigger on action definition changes

**Exit criteria:** Agent can fetch vocabulary and see action types with verbs and typical fields.

---

### Phase 2: Parse Endpoint

**Scope:** Natural language parsing with vocabulary lookup.

**Deliverables:**
- [ ] `POST /api/parse` endpoint
- [ ] Tokenizer (whitespace + punctuation aware)
- [ ] Intent pattern matcher
- [ ] Entity resolution (integrate with existing search)
- [ ] Field inference (numeric, date, currency patterns)

**Exit criteria:** `"invoice henderson 5000"` returns structured intent with resolved entity and inferred amount.

---

### Phase 3: Creation Router

**Scope:** Turn parsed intent into executable creation plans.

**Deliverables:**
- [ ] `POST /api/actions/resolve-creation` endpoint
- [ ] Mode detection (instance / clone / derive)
- [ ] Definition resolution
- [ ] Field suggestion from context
- [ ] Clone source resolution

**Exit criteria:** Parse result can be passed to creation router and return a ready-to-execute plan.

---

### Phase 4: MCP Integration

**Scope:** Expose vocabulary and parsing to agents via MCP.

**Deliverables:**
- [ ] `get_vocabulary` MCP tool
- [ ] `parse_intent` MCP tool
- [ ] Version-based caching for agents
- [ ] Agent documentation

**Exit criteria:** Claude can query vocabulary, parse user requests, and construct valid action payloads without full schema.

---

### Phase 5: Import Learning

**Scope:** Learn term associations from import history.

**Deliverables:**
- [ ] Import log schema (if not exists)
- [ ] Term extraction during import
- [ ] Confidence scoring (frequency × recency)
- [ ] Association pruning (stale, low-confidence)
- [ ] Rebuild trigger on import completion

**Exit criteria:** After importing "Henderson Project" data, "henderson" resolves to that project in subsequent parses.

---

### Phase 6: Composer Integration

**Scope:** Replace Composer dropdowns with single input bar.

**Deliverables:**
- [ ] Input bar component with parse-as-you-type
- [ ] Preview panel showing parsed intent
- [ ] Disambiguation UI (when confidence < threshold)
- [ ] Field editor for adjustments
- [ ] Execute action

**Exit criteria:** User can type `invoice henderson 5000` and create an invoice with two clicks (type → confirm).

---

### Phase 7: Command Bar

**Scope:** Global command bar using same infrastructure.

**Deliverables:**
- [ ] Cmd+K / Ctrl+K binding
- [ ] Quick actions (create, search, navigate)
- [ ] Recent commands
- [ ] Keyboard navigation

**Exit criteria:** Command bar is the fastest way to do anything in AutoArt.

---

## Risks and Mitigations

### Token Budget Enforcement

**Risk:** Vocabulary grows beyond 500 tokens, degrading agent efficiency.

**Mitigation:**
- Hard cap in builder with priority-based pruning
- Monitor snapshot size in metrics
- Alert if approaching limit

### Confidence Calibration

**Risk:** Import-derived associations are noisy. "client" maps to Contact 80% of the time but ClientProject 20%.

**Mitigation:**
- Threshold at 0.6 confidence for inclusion
- Surface low-confidence matches as suggestions, not assumptions
- Allow manual overrides to boost/suppress associations

### Staleness

**Risk:** Schema changes but vocabulary hasn't rebuilt. Agents construct invalid payloads.

**Mitigation:**
- Synchronous rebuild on migration (acceptable latency for admin action)
- Version check on every agent call
- Parse endpoint validates against current schema, not just vocabulary

### Ambiguous Input

**Risk:** `"henderson"` alone — is it a search? A query? Context-dependent.

**Mitigation:**
- Default to query (show details) for single entity
- Require signal word for other intents
- Surface confidence in response; let consumer decide threshold

### Multi-Tenant Vocabulary Drift

**Risk:** Different workspaces develop different terminology.

**Mitigation:**
- Phase 1-4: Single global vocabulary (acceptable for single-tenant)
- Future: Per-workspace vocabulary with inheritance from global base

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Vocabulary size | < 500 tokens | Snapshot byte count / 4 |
| Parse latency | < 50ms p95 | APM |
| Parse accuracy | > 85% correct intent | Sample audit |
| Agent token savings | > 60% vs full schema | Compare payload sizes |
| Composer adoption | > 50% of creates via input bar | Analytics |

---

## Open Questions

1. **Plural handling** — Should "invoices" map to search and "invoice" to create? Or require explicit signal?

2. **Negation** — How to handle "not henderson" or "except invoices"?

3. **Chained actions** — "invoice henderson and send email" — defer or support?

4. **Undo** — If parse was wrong, how does user correct without starting over?

5. **Learning from corrections** — If user changes "henderson" to "morrison" after parse, should that affect future confidence?

---

## References

- `docs/DESIGN.md` — Design system principles
- `backend/src/modules/actions/` — Current action creation flow
- `frontend/src/components/Composer/` — Current Composer implementation
- `shared/schemas/` — Action schemas
