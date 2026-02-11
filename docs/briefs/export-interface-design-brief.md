# Export Interface — Design Brief

*For design review. Describes intention, not implementation.*

---

## What This Tool Is

The export tool is where a user turns their project data into a deliverable document. It's the last step before something leaves the system and enters someone else's hands — a client report, a program summary, a status update for stakeholders. The output is professional, opinionated, and formatted. The user's job is to say *what* goes out and *how* it looks. The system does the rest.

This is not a reporting dashboard. It's not an analytics view. It's a **document assembly tool** — closer to print preview than to a spreadsheet.

---

## Who Uses It and When

One person, usually at the end of a work session or before a meeting. They've been updating project data — statuses, next steps, contacts, budgets — and now they need to package that work into something external.

They already know which projects matter. They might have 5, they might have 40. The interface should respect that they've already done the thinking. It should not make them re-think.

---

## The Core Interaction

**Select → Configure → Export → Get the file.**

That's the whole thing. Four beats. Each should feel like one action, not a workflow.

### 1. Select

The user picks which projects go into the document. This might come from:
- Manually checking projects in a list
- Importing a set from somewhere else in the system (a collection, an import batch, a filtered view)
- Re-running a previous export with updated data

The selection is a **snapshot**. Once the user says "these projects," the set is locked. Editing project data elsewhere doesn't silently change what's queued. This is a print queue, not a live view.

### 2. Configure

Two decisions:
- **Format.** RTF, Markdown, CSV, PDF, Google Docs, etc. The user picks one. The system knows what each format can and can't do.
- **Content toggles.** What sections to include — contacts, budgets, milestones, status notes, next steps. These are on/off. No partial inclusion, no per-project overrides. The document is uniform.

Configuration should feel like setting a dial, not filling out a form. Reasonable defaults, minimal surface area.

### 3. Export

One button. The system projects, formats, and produces the output. If it takes more than a few seconds, progress is visible but not noisy. No spinners that feel like apology.

### 4. Get the File

- Text formats: copyable content, right there. No download required.
- Binary formats: download link. One click.
- Cloud formats: opens in the target app. Link persists for reference.

The output panel should feel like a receipt — confirmation that the work is done, with everything needed to use the result.

---

## The Queue (Deferred, Not Abandoned)

The original architectural intent was a persistent queue — multiple export packages lined up, each from a different source, each independently configurable. A print queue model. This was the right idea:

- A user might assemble exports from different sources in the same session
- They might want to batch-execute several at once
- Packages should persist across sessions — come back tomorrow, your queue is still there
- Import data that needs resolution before export can sit in the queue until it's ready

This queue model was planned but the Phase 1 implementation was closed without shipping. The brief acknowledges it as the intended direction. The current session-based flow is the foundation the queue wraps around — sessions are the execution engine, the queue is the intake layer.

---

## Context Intelligence

The export moment is also a natural checkpoint. The user is about to send work out — this is when they should know:

- **Which projects are stale.** Haven't been updated in N days. Not an error, just information. The user decides if it matters.
- **Which outreach is unanswered.** Email decay — sent something, got nothing back. Relevant when the deliverable includes status language.
- **How the document compares to an existing one.** Backfeed analysis — if they're updating a Google Doc that already exists, show what's changed, what matches, what's new.

These are **ambient signals**, not gates. They inform the export, they don't block it. They should be visible but quiet — available without demanding attention.

---

## What It Should Feel Like

**Calm authority.** The user is packaging work they've already done. The interface should reflect that confidence — no warnings, no upsells, no "are you sure?" friction. They selected the projects, they picked the format, they pressed export. Trust them.

**Speed over ceremony.** A user who knows what they want should be able to go from opening the export panel to having a file in under 10 seconds. The interface should support muscle memory — same positions, same flow, every time.

**Material honesty.** The preview should look like the output. If the RTF has specific formatting, the preview shows that formatting. No bait-and-switch between what the user sees and what the recipient gets. If a format can't represent something (CSV can't show rich text), the preview communicates that clearly.

---

## What It Should Not Be

- **Not a project browser.** The export sidebar is for selection, not for browsing project details. Deep project context lives elsewhere.
- **Not a template builder.** The system has opinionated formats. The user picks one. Custom templates are a future concern, not a current one.
- **Not a history viewer.** Previous exports are reference, not a primary surface. "Re-run this export" is useful. "Browse all exports from last month" is a different tool.
- **Not clever.** No AI suggestions for what to export. No "you might also want to include..." prompts. The user knows their deliverable. The tool executes.

---

## Design Constraints (from DESIGN.md)

- All workspace surfaces use `--ws-*` tokens. No `--pub-*` leakage.
- Feedback colors: Moss Green (complete), Desaturated Amber (incomplete/stale), Iron Red (error). No traffic lights.
- Source Sans 3 for all UI chrome. Source Serif 4 only if project names or headings warrant weight.
- No modals for configuration. Inline, always visible.
- Empty states are silent — blank fields, visible labels, no commentary.
- Motion: 120-160ms ease-out. Nothing noticeable.

---

## Open Questions for Design Review

1. **Format selection UX.** Nine formats in a horizontal row is a lot of buttons. Is there a natural grouping (text / binary / cloud) that reduces visual weight? Or does the flat row actually work because it's scannable?

2. **Options visibility.** The content toggles (include contacts, include budgets, etc.) exist but aren't surfaced in the current configure step. Where should they live — inline below the format bar? A collapsible section? A sidebar inspector? The answer affects whether "configure" feels like one beat or two.

3. **Context intelligence placement.** Staleness, email decay, and backfeed analysis are powerful but secondary. They currently occupy the center content area, which competes with preview. Should they live in a collapsible drawer? A sidebar tab? Only appear when relevant?

4. **Preview weight.** How much space should the preview get? Is it a glanceable confirmation ("yep, that looks right") or a detailed document view the user actually reads through? The answer changes the layout math.

5. **Queue integration path.** When the queue ships, the left sidebar becomes a package list instead of a project picker. How should the current single-session flow degrade/upgrade gracefully? Is there a design that works for both one-shot exports and queued batches without a modal switch?

6. **Re-export pattern.** Users will re-export the same project set with updated data regularly (weekly BFA reports). How should "do the same thing I did last time, but with fresh data" work? Saved presets? Most-recent session replay? Something else?
