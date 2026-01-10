# PR #2: Medium Priority QoL - Enhanced UX Polish

## Summary
Adds keyboard shortcuts, relative timestamps, date bucket headers, and other polish features to improve the overall UX of the Execution Log and Project views.

## Changes

### New Hooks
1. **useKeyboardShortcuts.ts** - Reusable keyboard shortcut system
   - Cross-platform key combination matching (Ctrl/Cmd aware)
   - Input/textarea exclusion logic
   - ESC key exception for clearing inputs
   - `formatShortcut()` helper for displaying shortcuts
   - Type-safe handler definitions

2. **useRelativeTime.ts** - Relative timestamp formatting
   - Auto-updating timestamps ("2m ago", "3h ago", etc.)
   - Configurable update intervals
   - "just now" support for recent events
   - `formatFullTimestamp()` for hover tooltips
   - Falls back to date format for old events (7+ days)

### New Molecules
3. **DateBucketHeader.tsx** - Sticky date section headers
   - Groups timeline events by day
   - Smart labels: "Today", "Yesterday", or relative
   - Shows full date on right side
   - Sticky positioning with backdrop blur
   - Divider line for visual separation

### Updated Components

4. **ProjectLogView.tsx**
   - ✅ **Keyboard shortcuts:**
     - `Cmd/Ctrl + K`: Focus composer
     - `Esc`: Clear composer and blur
   - ✅ **Relative timestamps:** Events show "2m ago" with hover for full timestamp
   - ✅ **Date bucket grouping:** Timeline organized by day with sticky headers
   - ✅ **Composer ref:** Direct DOM access instead of querySelector
   - ✅ **Placeholder hint:** Shows keyboard shortcuts in composer

5. **ProjectView.tsx**
   - ✅ **Keyboard shortcuts:**
     - `1`: Switch to Workflow tab
     - `2`: Switch to Log tab
   - ✅ **Conditional shortcuts:** Only enabled when project selected

## User Experience Impact

### Before
- No keyboard navigation
- All timestamps static ("10:23 AM")
- Flat timeline without date grouping
- No visual feedback for keyboard hints

### After
- **Power user friendly:** Quick navigation with 1/2 keys, composer focus with ⌘K
- **Better time awareness:** "5m ago" updates live, hover for exact time
- **Organized timeline:** Date buckets ("Today", "Yesterday") with sticky headers
- **Discoverable shortcuts:** Placeholder text hints at keyboard shortcuts

## Keyboard Shortcuts Reference

### ProjectView
| Shortcut | Action |
|----------|--------|
| `1` | Switch to Workflow tab |
| `2` | Switch to Log tab |

### ProjectLogView
| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Focus composer input |
| `Esc` | Clear composer and blur |
| `Enter` | Submit action declaration |

## Visual Examples

### Date Bucket Headers
```
┌─────────────────────────────────────────┐
│ TODAY ──────────── January 9, 2026      │
├─────────────────────────────────────────┤
│ ● Action Card (5m ago)                  │
│ ● Action Card (2h ago)                  │
└─────────────────────────────────────────┘
```

### Relative Timestamps
```
Event occurred at:     Display:        Hover:
2026-01-09 14:55:00   "5m ago"        "January 9, 2026 at 2:55:00 PM"
2026-01-09 12:30:00   "2h ago"        "January 9, 2026 at 12:30:00 PM"
2026-01-05 09:00:00   "4d ago"        "January 5, 2026 at 9:00:00 AM"
2025-12-15 10:00:00   "Dec 15"        "December 15, 2025 at 10:00:00 AM"
```

## Implementation Details

### Auto-updating Timestamps
Relative times auto-refresh every 60 seconds:
```tsx
const relativeTime = useRelativeTime(event.occurredAt);
// Updates: "just now" → "1m ago" → "2m ago" → ...
```

### Date Bucket Grouping
Cards grouped by flooring to day:
```tsx
const cardsByDate = useMemo(() => {
  const grouped = new Map<string, ActionCard[]>();
  for (const card of cards) {
    const dateKey = card.events[0]?.bucketTime.split('T')[0];
    grouped.set(dateKey, [...]);
  }
  return Array.from(grouped.entries()).sort(desc);
}, [cards]);
```

### Cross-platform Shortcuts
Hook detects Mac vs Windows/Linux:
```tsx
const isMac = /Mac|iPhone|iPod|iPad/.test(navigator.platform);
const modKey = isMac ? 'meta' : 'ctrl';
// Shows: "⌘K" on Mac, "Ctrl+K" on Windows
```

## Testing Checklist
- [ ] Keyboard shortcuts work on Mac and Windows
- [ ] Tab switching with 1/2 keys
- [ ] Composer focus with Cmd/Ctrl+K
- [ ] ESC clears composer even when focused
- [ ] Relative timestamps update every minute
- [ ] Hover shows full timestamp
- [ ] Date buckets render correctly
- [ ] "Today" and "Yesterday" labels work
- [ ] Sticky headers stay visible while scrolling
- [ ] Shortcuts disabled when no project selected

## Dependencies
- No new external dependencies
- Uses existing React hooks and browser APIs

## Performance Notes
- Timestamp updates throttled to 60s intervals
- Date bucket grouping memoized
- Keyboard listener properly cleaned up on unmount

## Follow-up Ideas
Next enhancements could include:
- Optimistic UI updates for instant feedback
- Event expansion/collapse for long lists
- Scroll restoration when switching tabs
- Transition animations between tabs
- Real-time updates via WebSocket
