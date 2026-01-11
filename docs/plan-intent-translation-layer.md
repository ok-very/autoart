# Intent Translation Layer

Architecture for the intent translation layer.

## Summary

The intent translation layer is a system that translates user intent into actions and events. It is a layer that sits between the user and the system, and it is responsible for understanding the user's intent and translating it into actions and events that the system can understand.

It is a surface that can be called throughout the app, but also a necessary addition to the import workbench, as csv imports may be missing instructions on how to map the CSV data to the actions and events that have correct intent and context.

## Facts   
The Import Workbench already exists to parse CSV files and create actions and events. 

It is missing instructions on how to map the CSV data to the actions and events that have the content of salient intent.



PHASE 0 — Lock the contracts (non-negotiable)

Before any code:

0.1 Canonical roles
Concept	Meaning	Mutable?
Definition	Proposes meaning / shape	yes
Action	Declared intent container	amendable
Event	Fact that occurred	immutable
Projection	Read-only derived view	replaceable
0.2 One rule agents must not violate

Events are the only thing that explains “what happened.”
No status fields, no hidden state machines.

 Shared schemas (foundation)

1.1 Event definition registry (shared)

Each event definition exports (placeholder):

export const MEETING_HELD = {
  type: "MEETING_HELD",
  schema: z.object({
    attendance: z.array(z.string()).optional(),
    minutesDocId: z.string().optional(),
  }),
  ui: {
    label: "Meeting held",
    verb: "held",
    icon: "calendar-check"
  }
}

we need a way to for the user to be able to define the event definitions when it is unclear.

PHASE 2 — INTENT TAXONOMY




2.2 Deterministic interpretation steps

For each CSV “row group” (e.g. “Coordinate Selection Panel #2”):

Create Action

createAction({
  definitionId: ensureActionDefinition("Meeting coordination"),
  title: "Coordinate Selection Panel #2",
  contextId: projectRootId
})


For each sub-row
Apply mapping rules:

CSV text	Emit
“Create meeting agenda”	AGENDA_PREPARED
“Submit Artist Presentations…”	MATERIALS_SENT
“Meeting date”	MEETING_HELD

Mapping rules live in:

interpreter/mappings/
MEETING_SCHEDULED
AGENDA_PREPARED
MATERIALS_SENT
MEETING_HELD
MEETING_CANCELLED
MEETING_RESCHEDULED
FOLLOWED_UP
CONTRACT_SENT
SIGNATURE_REQUESTED
SIGNATURE_RECEIVED
CONTRACT_EXECUTED
CONTRACT_AMENDED
DOCUMENT_FILED
INVOICE_DRAFTED
INVOICE_REVISED
INVOICE_SUBMITTED
INVOICE_REJECTED
PAYMENT_RECORDED
PROCESS_INITIATED
PROCESS_COMPLETED
STAGE_INITIATED
STAGE_COMPLETED

They are pure functions:

function mapCsvRow(row): EventInput[]


No DB logic inside them.
But they do require their defined emitted events and proper mapping.
PHASE 3 — Definition auto-creation (safe + explicit)

Never infer silently.

Instead:

ensureEventDefinition({
  type: "FOLLOWED_UP",
  payloadShape: { channel?: string },
  source: "csv-import",
  confidence: "low"
})


This creates:

a draft definition

flagged needs_review = true

3.2 UI consequence

Draft definitions:

appear in Definitions → Events

show a “⚠ Review needed” badge

can be edited or merged

PHASE 4 — Backend enforcement
4.1 emitEvent pipeline

All events go through:

emitEvent
 → validate against shared schema in workbench view
 → write to events table
 → notify projections


No bypasses.

4.2 Projection rebuildability

Projections must:

be deletable

be re-runnable

never store canonical truth

PHASE 5 — UI integration
5.1 Project Log (authoring surface)

This is where users live.

Components:

ActionView
 ├─ Timeline (events)
 ├─ Current summary (projection)
 └─ Affordances (derived from definitions)

5.2 How affordances are generated

Rule:

If an event has a definition, it can be offered as an affordance.

Example:

If MEETING_HELD is not present
→ show “Record meeting held” button


This logic lives in:

ui/affordances/useActionAffordances(actionId)


It:
checks existing events

checks event definitions

returns buttons + forms

No hardcoded workflows.

PHASE 6 — Project integration checklist

Load CSV

Group rows by top-level item

For each group:

ensure Action Definition

create Action

map sub-rows to Events

For each Event:

ensure Event Definition exists

validate payload

emit via emitEvent

Report:

any draft definitions created
any rows skipped + why

PHASE 7 — Why this scales without collapsing
CSVs don’t define ontology — definitions do
Users don’t see schemas — they see verbs
You can add contract workflows, invoices, reviews without:
new status enums
new task types

new hierarchy

Everything becomes:

“Here’s what happened. Here’s what you can record next.”

Examples:
import { z } from "zod";

/**
 * ---------------------------------------------------------------------
 * Event type enum
 * ---------------------------------------------------------------------
 * These are USER-VISIBLE fact events.
 * Do NOT include them in any "system event" exclusion list.
 */

export const MeetingEventType = {
  MEETING_SCHEDULED: "MEETING_SCHEDULED",
  AGENDA_PREPARED: "AGENDA_PREPARED",
  MATERIALS_SENT: "MATERIALS_SENT",
  REMINDER_SENT: "REMINDER_SENT",
  MEETING_HELD: "MEETING_HELD",
} as const;

export type MeetingEventType =
  (typeof MeetingEventType)[keyof typeof MeetingEventType];

/**
 * ---------------------------------------------------------------------
 * Base event payload contract
 * ---------------------------------------------------------------------
 * Payloads describe *what happened*, never state transitions.
 */

export const BaseEventPayload = z.object({});

/**
 * ---------------------------------------------------------------------
 * MEETING_SCHEDULED
 * ---------------------------------------------------------------------
 * A meeting was planned for a specific time.
 */

export const MeetingScheduledPayload = BaseEventPayload.extend({
  plannedAt: z.string().datetime(),
  meetingLink: z.string().url().optional(),
  location: z.string().optional(),
});

/**
 * ---------------------------------------------------------------------
 * AGENDA_PREPARED
 * ---------------------------------------------------------------------
 * An agenda document was created or finalized.
 */

export const AgendaPreparedPayload = BaseEventPayload.extend({
  agendaDocId: z.string(),
});

/**
 * ---------------------------------------------------------------------
 * MATERIALS_SENT
 * ---------------------------------------------------------------------
 * Materials were transmitted to one or more audiences.
 */

export const MaterialsSentPayload = BaseEventPayload.extend({
  audiences: z.array(z.string()).min(1),
  materials: z.array(z.string()).min(1),
  delivery: z
    .object({
      channel: z.string(),        // "email", "upload", "sharepoint", etc.
      threadId: z.string().optional(),
    })
    .optional(),
});

/**
 * ---------------------------------------------------------------------
 * REMINDER_SENT
 * ---------------------------------------------------------------------
 * A reminder communication occurred.
 */

export const ReminderSentPayload = BaseEventPayload.extend({
  audience: z.array(z.string()).min(1),
  messageType: z.string().optional(), // "meeting reminder", "follow-up"
});

/**
 * ---------------------------------------------------------------------
 * MEETING_HELD
 * ---------------------------------------------------------------------
 * The meeting actually occurred.
 */

export const MeetingHeldPayload = BaseEventPayload.extend({
  attendance: z.array(z.string()).optional(),
  minutesDocId: z.string().optional(),
});

/**
 * ---------------------------------------------------------------------
 * Event schema registry
 * ---------------------------------------------------------------------
 * This is the single source of truth used by:
 * - backend validation before emitEvent(...)
 * - frontend composer / renderer
 * - interpreter tests
 */

export const MeetingEventSchemas = {
  [MeetingEventType.MEETING_SCHEDULED]: MeetingScheduledPayload,
  [MeetingEventType.AGENDA_PREPARED]: AgendaPreparedPayload,
  [MeetingEventType.MATERIALS_SENT]: MaterialsSentPayload,
  [MeetingEventType.REMINDER_SENT]: ReminderSentPayload,
  [MeetingEventType.MEETING_HELD]: MeetingHeldPayload,
} as const;

/**
 * ---------------------------------------------------------------------
 * Discriminated union (optional but recommended)
 * ---------------------------------------------------------------------
 * Useful for validation pipelines and test assertions.
 */

export const MeetingEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(MeetingEventType.MEETING_SCHEDULED),
    payload: MeetingScheduledPayload,
  }),
  z.object({
    type: z.literal(MeetingEventType.AGENDA_PREPARED),
    payload: AgendaPreparedPayload,
  }),
  z.object({
    type: z.literal(MeetingEventType.MATERIALS_SENT),
    payload: MaterialsSentPayload,
  }),
  z.object({
    type: z.literal(MeetingEventType.REMINDER_SENT),
    payload: ReminderSentPayload,
  }),
  z.object({
    type: z.literal(MeetingEventType.MEETING_HELD),
    payload: MeetingHeldPayload,
  }),
]);

export type MeetingEvent = z.infer<typeof MeetingEvent>;
