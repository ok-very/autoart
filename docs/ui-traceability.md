# UI Traceability Convention

This document defines the `data-aa-*` attribute convention for tracing UI interactions back to their source components.

## Purpose

Traceability attributes help:
- Debug issues by identifying which UI component triggered an API call
- Understand user workflows through log analysis
- Correlate frontend actions with backend operations

## Important Notes

> ⚠️ **Traceability is diagnostic only:**
> - Must NOT affect business logic
> - Must NOT block mutations
> - Must NOT be required for API correctness
> - Missing context must NOT cause errors

## Attribute Convention

### `data-aa-id`
Unique identifier for interactive elements within a component.

```tsx
<button data-aa-id="save-record">Save</button>
<input data-aa-id="field-title" />
```

### `data-aa-component`
Identifies the component containing the element.

```tsx
<div data-aa-component="RecordInspector">
  <button data-aa-id="save">Save</button>
</div>
```

### `data-aa-view`
Page-level or major view identification.

```tsx
<main data-aa-view="RecordsPage">
  ...
</main>
```

### `data-aa-action`
The action type for buttons/triggers.

```tsx
<button data-aa-action="create" data-aa-id="create-record">
  Create Record
</button>
```

## Naming Conventions

| Attribute | Format | Example |
|-----------|--------|---------|
| `data-aa-id` | kebab-case, descriptive | `save-record`, `field-email` |
| `data-aa-component` | PascalCase, component name | `RecordInspector`, `BottomDrawer` |
| `data-aa-view` | PascalCase, page name | `RecordsPage`, `LoginPage` |
| `data-aa-action` | kebab-case, verb | `create`, `update`, `delete` |

## UI Context Header

API requests include a `x-ui-context` header with JSON:

```json
{
  "component": "RecordInspector",
  "action": "update",
  "elementId": "save-record",
  "view": "RecordsPage",
  "timestamp": 1704067200000
}
```

## Implementation Priority

### High Priority (add immediately)
- Buttons that trigger API mutations (create, update, delete)
- Form submit handlers
- Drawer open/close triggers

### Medium Priority
- Search inputs
- Filter controls
- Navigation elements

### Low Priority (optional)
- Display-only elements
- Static content

## Examples

### Button with full context
```tsx
<button
  data-aa-component="RecordInspector"
  data-aa-id="save-record"
  data-aa-action="update"
  onClick={handleSave}
>
  Save Changes
</button>
```

### Form field
```tsx
<input
  data-aa-component="RecordEditor"
  data-aa-id="field-title"
  value={title}
  onChange={handleChange}
/>
```

### Drawer trigger
```tsx
<button
  data-aa-component="RecordsTable"
  data-aa-id="open-create-drawer"
  data-aa-action="open-drawer"
  onClick={() => openDrawer('create-record')}
>
  + New Record
</button>
```

## Testing

Verify traceability in browser DevTools:
1. Open Network tab
2. Perform an action (e.g., save a record)
3. Check request headers for `x-ui-context`
4. Verify JSON contains expected component/action info
