## 🎹  Composer – the “Task Builder” on top of the **Action + Event** architecture  

The Composer is a **first‑class backend module** that lets the rest of the code‑base (UI, integrations, scripts, tests…) create *any* “task‑like” work item **without ever touching the legacy `task` table**.  
All it does is:

1. **Create an `Action`** (the intent of the work item).  
2. **Emit the minimal set of `Event`s** that make the intent a fact in the event log (e.g. `ACTION_DECLARED`, `FIELD_VALUE_RECORDED`, `ASSIGNEE_SET`, …).  
3. **Create `ActionReference`s** that bind the new action to existing records (e.g. a Project, a Sprint, a User).  
4. **Return a “view”** (computed by the interpreter) so the caller can render the new item immediately.

> **Why a module, not just a helper?**  
> * It isolates the transactional logic (Action → Events → References) in one place.  
> * It guarantees the **no‑legacy‑writes guardrail** – any attempt to write a `task` node will be rejected at compile‑time (type‑wise) and runtime (validation).  
> * It gives us a clean public contract (`POST /composer`) that can evolve independently from the UI.

Below is a **complete implementation sketch** for a NestJS‑style backend (the same pattern works with Express, Fastify, or any DI container you use).  
Feel free to adapt the folder names if your project uses a different layout.

---  

## 📁  File‑Structure Overview

```
backend/
│
├─ src/
│   ├─ modules/
│   │   ├─ composer/
│   │   │   ├─ composer.module.ts
│   │   │   ├─ composer.service.ts
│   │   │   ├─ composer.controller.ts
│   │   │   ├─ dto/
│   │   │   │   ├─ composer-input.dto.ts
│   │   │   │   └─ composer-response.dto.ts
│   │   │   └─ utils/
│   │   │       └─ event-factory.ts
│   │   └─ ... (other modules)
│   └─ ... (app bootstrap)
│
└─ shared/
    └─ src/
        └─ schemas/
            ├─ actions.ts          (already exists)
            ├─ events.ts           (already exists)
            ├─ references.ts       (already exists)
            └─ composer.ts         ← **new**
```

---

## 🔧  Shared Zod Schemas – `composer.ts`

These schemas live in the **shared package** because they are used by the backend **and** the frontend (type‑generation, validation, documentation).

```ts
// shared/src/schemas/composer.ts
import { z } from 'zod';
import {
  ActionSchema,
  CreateActionInputSchema,
} from './actions';
import {
  CreateEventInputSchema,
  EventSchema,
} from './events';
import {
  CreateActionReferenceInputSchema,
  ActionReferenceSchema,
} from './references';

/**
 * Minimal “field value” payload that the Composer can turn into a FIELD_VALUE_RECORDED event.
 */
export const ComposerFieldValueSchema = z.object({
  /** Name of the field as defined in the Action’s fieldBindings (e.g. "title", "dueDate") */
  fieldName: z.string(),
  /** Any JSON‑serialisable value – validation is delegated to the Action’s schema at runtime */
  value: z.any(),
});

/**
 * Public contract for a Composer request.
 *
 * 1️⃣  `action`  – the Action you want to declare (type + optional fieldBindings).  
 * 2️⃣  `fieldValues` – list of initial field values that will become FIELD_VALUE_RECORDED events.  
 * 3️⃣  `references` – optional ActionReferences to existing Records (e.g. projectId, sprintId).  
 * 4️⃣  `emitExtraEvents` – an **advanced** escape‑hatch for callers that need to emit arbitrary events
 *      (e.g. WORK_STARTED right after creation).  It is validated against the generic Event schema.
 */
export const ComposerInputSchema = z.object({
  action: CreateActionInputSchema,
  fieldValues: z.array(ComposerFieldValueSchema).optional(),
  references: z.array(CreateActionReferenceInputSchema).optional(),
  emitExtraEvents: z.array(CreateEventInputSchema).optional(),
});

export type ComposerInput = z.infer<typeof ComposerInputSchema>;

/**
 * What the Composer returns – the created Action, all Events that were written,
 * and the *computed* ActionView (optional, filled by the controller).
 */
export const ComposerResponseSchema = z.object({
  action: ActionSchema,
  events: z.array(EventSchema),
  references: z.array(ActionReferenceSchema).optional(),
  view: z.any().optional(), // will be the shape of ActionView once interpreter runs
});

export type ComposerResponse = z.infer<typeof ComposerResponseSchema>;
```

> **Note** – The schema deliberately does **not** expose any `Task`‑related fields. If a client still wants to create a legacy task, they must call a *different* migration endpoint (which we are deprecating).

---

## 🛠️  Composer Service – Core Logic  

All work happens inside a **single DB transaction** so the Action, its Events, and its References are atomic.

```ts
// backend/src/modules/composer/composer.service.ts
import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service'; // or your DB wrapper
import {
  ComposerInput,
  ComposerResponse,
  ComposerFieldValueSchema,
} from '@shared/schemas/composer';
import { Action, Event, ActionReference } from '@prisma/client'; // adapt to your ORM
import { EventFactory } from './utils/event-factory';
import { InterpreterService } from '../interpreter/interpreter.service'; // optional – for view generation

@Injectable()
export class ComposerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly interpreter: InterpreterService, // can be omitted if you only need raw data
  ) {}

  /**
   * Main entry point – creates an Action, the associated Events, and any ActionReferences.
   *
   * @param input   validated ComposerInput (already parsed by the controller)
   * @param actorId ID of the user (or service) that is performing the composition
   */
  async compose(input: ComposerInput, actorId: string): Promise<ComposerResponse> {
    // Defensive guard – we never write to the deprecated task tables.
    if (input.action.type === 'legacy_task') {
      throw new BadRequestException('Legacy task creation is not allowed via Composer.');
    }

    // Run everything in a transaction so we can roll back on any failure.
    return await this.prisma.$transaction(async (tx) => {
      // -----------------------------------------------------------------------
      // 1️⃣  CREATE THE ACTION
      // -----------------------------------------------------------------------
      const action = await tx.action.create({
        data: {
          type: input.action.type,
          fieldBindings: input.action.fieldBindings ?? null,
          createdById: actorId,
          // any other columns you have (e.g. organizationId, workspaceId) can be added here
        },
      });

      // -----------------------------------------------------------------------
      // 2️⃣  BUILD THE EVENT LIST
      // -----------------------------------------------------------------------
      const events: Event[] = [];

      // ACTION_DECLARED is always the first event – it anchors the entire chain.
      events.push(
        EventFactory.actionDeclared(action.id, {
          type: action.type,
          fieldBindings: action.fieldBindings,
        })
      );

      // Emit FIELD_VALUE_RECORDED for each supplied field value.
      if (input.fieldValues?.length) {
        for (const fv of input.fieldValues) {
          // Validate against the Action’s fieldBindings at runtime (optional but recommended)
          this.ensureFieldAllowed(action, fv.fieldName);
          events.push(
            EventFactory.fieldValueRecorded(action.id, {
              fieldName: fv.fieldName,
              value: fv.value,
            })
          );
        }
      }

      // If the caller gave us arbitrary extra events, just validate them against the generic schema.
      if (input.emitExtraEvents?.length) {
        for (const extra of input.emitExtraEvents) {
          events.push({
            actionId: action.id,
            type: extra.type,
            payload: extra.payload,
          });
        }
      }

      // -----------------------------------------------------------------------
      // 3️⃣  PERSIST EVENTS
      // -----------------------------------------------------------------------
      const createdEvents = await tx.event.createMany({
        data: events.map((e) => ({
          actionId: e.actionId,
          type: e.type,
          payload: e.payload,
        })),
        skipDuplicates: false,
      });

      // Prisma's `createMany` returns a count; we want the full rows.
      // For simplicity we re‑fetch them – in a real code‑base you could use `create` in a loop.
      const persistedEvents = await tx.event.findMany({
        where: { actionId: action.id },
        orderBy: { createdAt: 'asc' },
      });

      // -----------------------------------------------------------------------
      // 4️⃣  CREATE ACTION_REFERENCES (if any)
      // -----------------------------------------------------------------------
      let references: ActionReference[] = [];
      if (input.references?.length) {
        const refRows = input.references.map((ref) => ({
          actionId: action.id,
          sourceRecordId: ref.sourceRecordId,
          legacyTaskReferenceId: ref.legacyTaskReferenceId ?? null,
        }));
        await tx.actionReference.createMany({ data: refRows });
        references = await tx.actionReference.findMany({
          where: { actionId: action.id },
        });
      }

      // -----------------------------------------------------------------------
      // 5️⃣  OPTIONAL – COMPUTE THE ACTION VIEW
      // -----------------------------------------------------------------------
      let view: unknown = undefined;
      try {
        view = await this.interpreter.computeActionView(action.id);
      } catch (e) {
        // Not fatal – the caller still gets the raw data.
        console.warn('Composer: interpreter failed to compute view', e);
      }

      // -----------------------------------------------------------------------
      // 6️⃣  RETURN THE COMPOSER RESPONSE
      // -----------------------------------------------------------------------
      return {
        action,
        events: persistedEvents,
        references: references.length ? references : undefined,
        view,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Helper – ensure a field name exists in the Action’s declared bindings.
  // -------------------------------------------------------------------------
  private ensureFieldAllowed(action: Action, fieldName: string) {
    const bindings = action.fieldBindings as Record<string, unknown> | null;
    if (!bindings || !(fieldName in bindings)) {
      // The field is not part of the Action’s schema – we reject early.
      throw new BadRequestException(
        `Field "${fieldName}" is not declared in Action type "${action.type}".`,
      );
    }
  }
}
```

### What `EventFactory` looks like

```ts
// backend/src/modules/composer/utils/event-factory.ts
import { Event } from '@prisma/client';

/**
 * Small utility that builds well‑typed Event objects.
 * All events must contain the `actionId` of the Action they belong to.
 */
export class EventFactory {
  static actionDeclared(actionId: string, payload: { type: string; fieldBindings?: any }): Event {
    return {
      actionId,
      type: 'ACTION_DECLARED',
      payload,
    } as Event;
  }

  static fieldValueRecorded(
    actionId: string,
    payload: { fieldName: string; value: unknown },
  ): Event {
    return {
      actionId,
      type: 'FIELD_VALUE_RECORDED',
      payload,
    } as Event;
  }

  // Extend with convenience factories for common domain events:
  static assigneeSet(actionId: string, payload: { assigneeId: string }) {
    return {
      actionId,
      type: 'ASSIGNEE_SET',
      payload,
    } as Event;
  }

  static dueDateSet(actionId: string, payload: { dueDate: string }) {
    return {
      actionId,
      type: 'DUE_DATE_SET',
      payload,
    } as Event;
  }

  // …any other event factories you need
}
```

---

## 📡  Composer Controller – Public HTTP endpoint  

A thin wrapper that parses, validates, and forwards the request to the service.  

```ts
// backend/src/modules/composer/composer.controller.ts
import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ComposerService } from './composer.service';
import { ComposerInputSchema, ComposerResponseSchema } from '@shared/schemas/composer';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'; // adjust to your auth layer

@Controller('composer')
export class ComposerController {
  constructor(private readonly composer: ComposerService) {}

  /**
   * POST /composer
   *
   * Body must conform to ComposerInputSchema.
   * Returns ComposerResponseSchema.
   */
  @UseGuards(JwtAuthGuard) // optional – you probably protect it
  @Post()
  async compose(@Body() rawBody: unknown, @Req() req: Request) {
    const parseResult = ComposerInputSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error);
    }

    const actorId = (req.user as any).sub; // depends on your JWT payload shape
    const response = await this.composer.compose(parseResult.data, actorId);

    // Validate response before sending – helps catch accidental schema drift.
    const out = ComposerResponseSchema.parse(response);
    return out;
  }
}
```

---

## 📦  Composer Module – NestJS wiring  

```ts
// backend/src/modules/composer/composer.module.ts
import { Module } from '@nestjs/common';
import { ComposerService } from './composer.service';
import { ComposerController } from './composer.controller';
import { PrismaModule } from '../../prisma.module';
import { InterpreterModule } from '../interpreter/interpreter.module';

@Module({
  imports: [PrismaModule, InterpreterModule],
  providers: [ComposerService],
  controllers: [ComposerController],
  exports: [ComposerService],
})
export class ComposerModule {}
```

Add `ComposerModule` to your root `AppModule` (or wherever you register feature modules).

---

## ⚡  High‑level “one‑liner” usage examples  

Below are a few **real‑world composition patterns** that the UI (or a script) can invoke.  
All of them are just **thin wrappers** around the generic `ComposerService.compose()`.

### 1️⃣  Create a “Task‑like” Action (the exact replacement for the old `POST /tasks`)

```ts
// UI (React, Angular, etc.) – using the shared Zod types for type‑safety
import { ComposerInputSchema } from '@shared/schemas/composer';

const payload = ComposerInputSchema.parse({
  action: {
    type: 'TASK',               // any Action type you have defined
    fieldBindings: {
      title: 'string',
      description: 'string',
      dueDate: 'date',
    },
  },
  fieldValues: [
    { fieldName: 'title', value: 'Write the Composer spec' },
    { fieldName: 'description', value: 'Add docs + code for the Composer module.' },
    { fieldName: 'dueDate', value: '2026-02-01' },
  ],
  references: [
    // e.g. link to the Project record the task belongs to
    { sourceRecordId: 'project-1234' },
  ],
});

await fetch('/api/composer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
  body: JSON.stringify(payload),
});
```

**Result** – The server will have created:

| Table                 | Row (example)                                                               |
|-----------------------|-----------------------------------------------------------------------------|
| `actions`             | `{ id: 'a1', type: 'TASK', fieldBindings: {title:string,…} }`              |
| `events`              | `ACTION_DECLARED`, `FIELD_VALUE_RECORDED(title)`, `FIELD_VALUE_RECORDED(description)`, `FIELD_VALUE_RECORDED(dueDate)` |
| `action_references`   | `{ actionId: 'a1', sourceRecordId: 'project-1234' }`                        |
| `action_view` (computed) | `{ title: 'Write the Composer spec', status: 'OPEN', … }` (via interpreter) |

No rows are ever inserted into `tasks` or `task_references`.

---

### 2️⃣  Create a “Bug” with extra domain events

```ts
const payload = ComposerInputSchema.parse({
  action: {
    type: 'BUG',
    fieldBindings: {
      title: 'string',
      severity: 'enum',
    },
  },
  fieldValues: [
    { fieldName: 'title', value: 'Crash when opening settings' },
    { fieldName: 'severity', value: 'HIGH' },
  ],
  emitExtraEvents: [
    // The UI wants to record that the bug is already assigned to an owner
    { type: 'ASSIGNEE_SET', payload: { assigneeId: 'user-42' } },
    // And that it is flagged for the next release
    { type: 'RELEASE_FLAGGED', payload: { releaseId: 'v2.0.0' } },
  ],
});
```

The service will **validate** `ASSIGNEE_SET` and `RELEASE_FLAGGED` against the generic `Event` schema, insert them **after** the `ACTION_DECLARED` event, and everything remains part of the same atomic transaction.

---

### 3️⃣  Convenient “factory” for common patterns (optional)

If you find yourself repeatedly building the same Composer payloads (e.g., a task with title/description/dueDate), you can create a tiny **wrapper library** on the client side:

```ts
// client/src/composer/factories.ts
import { ComposerInputSchema } from '@shared/schemas/composer';

export function makeTaskInput(
  title: string,
  description: string,
  dueDate: string,
  projectId: string,
) {
  return ComposerInputSchema.parse({
    action: {
      type: 'TASK',
      fieldBindings: { title: 'string', description: 'string', dueDate: 'date' },
    },
    fieldValues: [
      { fieldName: 'title', value: title },
      { fieldName: 'description', value: description },
      { fieldName: 'dueDate', value: dueDate },
    ],
    references: [{ sourceRecordId: projectId }],
  });
}
```

Now the UI code becomes a one‑liner:

```ts
await fetch('/api/composer', { …, body: JSON.stringify(makeTaskInput(...)) });
```

---

## 🛡️  Guardrails – “Never write a legacy task”

The Composer **enforces** the new architecture in three places:

| Layer | Guard |
|------|-------|
| **DTO (Zod)** | `ComposerInputSchema` does not contain any `taskReferenceId` or `taskId`. |
| **Service** | `if (input.action.type === 'legacy_task') …` throws a `BadRequestException`. |
| **Database** | Existing `hierarchy.service` already blocks `updateNode`/`deleteNode` on nodes marked `metadata.legacy_migrated`. No other module writes to `tasks`. |
| **CI / Tests** | Add a unit test that attempts `POST /composer` with a `type: 'LEGACY_TASK'` and expects a 400. |

If you later add a new *legacy* table for an even older migration, just add a similar guard in the service – the Composer stays pure.

---

## 🧪  Test Suite – Composer Service (Jest example)

```ts
// backend/src/modules/composer/composer.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ComposerService } from './composer.service';
import { PrismaService } from '../../prisma.service';
import { ComposerInputSchema } from '@shared/schemas/composer';

describe('ComposerService', () => {
  let service: ComposerService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComposerService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((cb) => cb({
              action: { create: jest.fn(), findUnique: jest.fn() },
              event: { createMany: jest.fn(), findMany: jest.fn() },
              actionReference: { createMany: jest.fn(), findMany: jest.fn() },
            })),
          },
        },
      ],
    }).compile();

    service = module.get<ComposerService>(ComposerService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('creates an action, events and references atomically', async () => {
    const payload = ComposerInputSchema.parse({
      action: { type: 'TASK', fieldBindings: { title: 'string' } },
      fieldValues: [{ fieldName: 'title', value: 'Write tests' }],
      references: [{ sourceRecordId: 'proj-1' }],
    });

    const result = await service.compose(payload, 'user-123');

    // Verify that an Action was created
    expect(result.action.type).toBe('TASK');

    // Verify the right events are present
    const types = result.events.map((e) => e.type);
    expect(types).toContain('ACTION_DECLARED');
    expect(types).toContain('FIELD_VALUE_RECORDED');

    // Verify a reference was persisted
    expect(result.references?.[0].sourceRecordId).toBe('proj-1');
  });

  it('rejects legacy task types', async () => {
    const payload = ComposerInputSchema.parse({
      action: { type: 'legacy_task', fieldBindings: {} },
    });

    await expect(service.compose(payload, 'user-123')).rejects.toThrow(
      /Legacy task creation is not allowed/,
    );
  });
});
```

Run with `npm run test`.  All other modules (hierarchy, interpreter, etc.) should already have their own test suites; the Composer tests are **integration‑style** because they use a mock `PrismaService` transaction.

---

## 📈  Performance & Scaling considerations  

| Concern | Recommendation |
|---------|----------------|
| **Event volume** – a single composition can emit dozens of events (e.g., a large form). | Use the `createMany` bulk insert that Prisma (or Knex) provides, as shown above. |
| **Transactional size** – a massive number of references could blow the transaction. | Put a hard limit (e.g., 200 references) in the DTO (`z.array(...).max(200)`). |
| **Interpretation latency** – the controller optionally asks the interpreter for a view. | Cache the view for the newly created action (the interpreter can store a memoized view for the next 5 seconds). |
| **Concurrent compositions** – two users may try to create the *same* Action (duplicate detection). | Add a unique constraint on `actions.type + actions.fieldBindings.title` if you need deduplication, or handle it at the UI level. |

---

## 📚  Documentation – How to use the Composer from the Front‑End  

Below is a **markdown snippet** you can paste into your internal API docs or wiki.

```markdown
# Composer API (POST /composer)

Create a new work item **without touching the legacy `tasks` table**.

## Request payload (JSON)

```json
{
  "action": {
    "type": "TASK",
    "fieldBindings": {
      "title": "string",
      "description": "string",
      "dueDate": "date"
    }
  },
  "fieldValues": [
    { "fieldName": "title", "value": "Write Composer spec" },
    { "fieldName": "description", "value": "Add docs + code for the Composer module." },
    { "fieldName": "dueDate", "value": "2026-02-01" }
  ],
  "references": [
    { "sourceRecordId": "project-1234" }
  ],
  "emitExtraEvents": [
    { "type": "ASSIGNEE_SET", "payload": { "assigneeId": "user-42" } }
  ]
}
```

* `action.type` – any Action type you have defined in your domain (`TASK`, `BUG`, `MEETING`, …).  
* `fieldValues` – **only** fields declared in `action.fieldBindings` are allowed.  
* `references` – optional links to existing `records` (project, sprint, etc.).  
* `emitExtraEvents` – **advanced**: any additional events you need (must conform to the generic Event schema).

## Response (JSON)

```json
{
  "action": { "id": "...", "type": "TASK", "fieldBindings": { … } },
  "events": [
    { "id": "...", "type": "ACTION_DECLARED", "payload": { … } },
    { "id": "...", "type": "FIELD_VALUE_RECORDED", "payload": { "fieldName": "title", "value": "Write Composer spec" } },
    …
  ],
  "references": [ { "id": "...", "actionId": "...", "sourceRecordId": "project-1234" } ],
  "view": { "title": "Write Composer spec", "status": "OPEN", "assigneeId": "user-42", … }
}
```

The `view` field is the **computed projection** of the newly created Action – you can render it straight away without an extra fetch.

## Errors

| Code | Reason |
|------|--------|
| `400 Bad Request` | Payload fails Zod validation, or you attempted to use a field not declared in the Action’s bindings, or you tried to create a `legacy_task`. |
| `401 Unauthorized` | No valid JWT / session. |
| `500 Internal Server Error` | Transaction failed (e.g., DB constraint). The response body contains the error message. |

---

## 🎯  When to use the Composer

* **Creating a new task, bug, story, or any custom Action** – *always* go through Composer.  
* **Bulk‑creating many actions** – call Composer repeatedly in a client‑side loop; each call is its own atomic transaction.  
* **Migrating legacy data** – the migration script (Phase 5) already creates Actions and Events directly; you don’t need Composer there.  

Never, ever, issue an `INSERT` into `tasks` or `task_references` from application code. The read‑only guardrails in `hierarchy.service` will reject such attempts, and the Composer will throw an early validation error.

---

## ✅  Wrap‑up – What the Composer gives you

| ✅ Feature | ✅ Benefit |
|------------|------------|
| **Single‑transaction creation** | Guarantees Action ↔ Events ↔ References are always in sync. |
| **Typed, declarative payload** | Front‑end and back‑end share the same Zod schemas → no “hand‑rolled” request bodies. |
| **No hidden state** | All state lives in the immutable event log; the Action is just a projection. |
| **Read‑only legacy fallback** | Existing UI components that still render old task nodes keep working (they are now read‑only). |
| **Extensible** | Add new domain events (e.g., `WORK_STARTED`) by just extending `EventFactory` and the shared `events.ts` schema – no database schema changes required. |
| **Future‑proof** | When you are ready to drop the read‑only `task` nodes completely, you can simply delete the guardrails and the UI will already be using the Composer. |

---

## 📦  How to ship it

1. **Add the module** to `src/app.module.ts` (or whatever your root module is).  
2. **Run migrations** (you already have `021_action_references` and `022_migrate_tasks_to_actions`). No new migrations are needed for Composer.  
3. **Update the OpenAPI spec** – you can generate it automatically from the Zod schema using `zod-to-openapi`.  
4. **Deploy** the backend, then point the UI to `/api/composer` instead of the old `/api/tasks`.  
5. **Monitor** the `actions` and `events` tables – the row counts should grow in lock‑step (1 Action ≈ 1+ Event rows).  

That’s it – you now have a **robust, testable, and future‑ready Composer** that replaces the old task‑creation path while fully leveraging the new **Action + Event** model. 🎉  