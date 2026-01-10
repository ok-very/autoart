# ProjectLogView Quality of Life Improvements

## Overview
Two-phase enhancement plan for the Execution Log view, split by priority to enable incremental delivery.

---

## PR #1: High Priority - Foundation ✅

**Branch:** `feature/log-view-foundation`  
**Estimated Effort:** 2-3 hours  
**Dependencies:** None

### Goals
Establish core UX patterns needed for immediate usability.

### Deliverables
1. **New Reusable Atoms**
   - `Skeleton` - Loading placeholders with presets
   - `EmptyState` - Actionable empty states
   - `Badge` updates - Count variant for tabs

2. **Log View Core**
   - Type-safe `projectId` handling (string consistency)
   - Loading states with skeleton cards
   - Improved empty state with CTA button
   - Filter infrastructure (sidebar + state management)

3. **Project View Updates**
   - Count badges on tabs
   - Sidebar toggling (workflow nav ↔ log filters)
   - Filter state management

### Files Changed
```
frontend/src/ui/atoms/
  ├── Skeleton.tsx (new)
  ├── EmptyState.tsx (new)
  ├── Badge.tsx (updated)
  └── index.ts (updated)

frontend/src/ui/composites/
  ├── ProjectLogView.tsx (updated)
  ├── LogSidebarFilters.tsx (new)
  ├── ProjectView.tsx (updated)
  └── index.ts (updated)
```

### API Integration Points
```tsx
// Ready for backend hookup:
const { data: cards, isLoading } = useProjectActions(projectId);
const actionCount = useProjectActionCount(projectId);
```

---

## PR #2: Medium Priority - Polish ✅

**Branch:** `feature/log-view-polish`  
**Estimated Effort:** 3-4 hours  
**Dependencies:** PR #1

### Goals
Add keyboard shortcuts, smart timestamps, and timeline organization for power users.

### Deliverables
1. **New Reusable Hooks**
   - `useKeyboardShortcuts` - Cross-platform shortcut system
   - `useRelativeTime` - Auto-updating relative timestamps

2. **New Molecules**
   - `DateBucketHeader` - Sticky date section headers

3. **Enhanced Interactions**
   - Keyboard navigation (tab switching, composer focus)
   - Relative timestamps with auto-updates
   - Date bucket grouping
   - Tooltip for full timestamps

### Files Changed
```
frontend/src/hooks/
  ├── useKeyboardShortcuts.ts (new)
  └── useRelativeTime.ts (new)

frontend/src/ui/molecules/
  └── DateBucketHeader.tsx (new)

frontend/src/ui/composites/
  ├── ProjectLogView.tsx (updated)
  └── ProjectView.tsx (updated)
```

### Keyboard Shortcuts
| Context | Shortcut | Action |
|---------|----------|--------|
| ProjectView | `1` | Switch to Workflow tab |
| ProjectView | `2` | Switch to Log tab |
| ProjectLogView | `⌘K` / `Ctrl+K` | Focus composer |
| ProjectLogView | `Esc` | Clear composer |
| ProjectLogView | `Enter` | Submit action |

---

## Combined Impact

### Before
```
┌────────────────────────────────────┐
│ Project: Building A                │
│ ┌────────────┬──────────────────┐  │
│ │ Workflow   │ Log              │  │
│ └────────────┴──────────────────┘  │
│                                    │
│ [Subprocess list]                  │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ Task table                     │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘

Log tab:
  • Empty: "No actions declared yet" (plain text)
  • No loading indication
  • Timestamps: "10:23 AM"
  • No grouping
  • Sidebar unused
```

### After
```
┌────────────────────────────────────┐
│ Project: Building A                │
│ ┌────────────┬──────────────────┐  │
│ │Workflow(12)│ Log              │  │← Count badges
│ └────────────┴──────────────────┘  │
│                                    │
│ [Subprocess list]  or  [Filters]   │← Contextual sidebar
│   • Select subprocess    • Search  │
│   • Task counts          • Status  │
│                          • Stats   │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ Task table                     │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘

Log tab:
  • Empty: Icon + description + "Declare Action" button
  • Loading: 3 animated skeleton cards
  • Timestamps: "5m ago" (hover for full)
  • Grouped: TODAY ──── Jan 9, 2026
  • Sidebar: Stats + filters
  • Shortcuts: ⌘K to compose, 1/2 to switch
```

---

## Testing Matrix

| Feature | PR | Test Case |
|---------|----|-----------| 
| **Loading States** | #1 | Skeletons show during fetch |
| **Empty State** | #1 | Shows icon + CTA when no actions |
| **Type Safety** | #1 | No projectId type mismatches |
| **Count Badges** | #1 | Show correct counts, hide when 0 |
| **Sidebar Toggle** | #1 | Workflow nav ↔ Log filters |
| **Filter Controls** | #1 | Search + status filters update state |
| **Tab Shortcuts** | #2 | `1`/`2` switch tabs |
| **Composer Shortcuts** | #2 | `⌘K` focus, `Esc` clear |
| **Relative Time** | #2 | Updates every minute, hover shows full |
| **Date Buckets** | #2 | Today/Yesterday labels, sticky headers |
| **Cross-platform** | #2 | Shortcuts work Mac + Windows |

---

## Migration Path

### Phase 1: Merge PR #1
1. Review and test foundation components
2. Merge to main
3. Create API integration ticket for backend
4. Deploy with feature flag if needed

### Phase 2: Merge PR #2
1. Ensure PR #1 is stable in production
2. Test keyboard shortcuts on both platforms
3. Verify timestamp auto-updates
4. Merge to main
5. Update user documentation with shortcuts

---

## Future Enhancements (Not in these PRs)

### Low Priority (Future)
- Optimistic UI updates
- Event expansion/collapse
- Scroll restoration between tabs
- Tab transition animations
- Real-time updates (WebSocket)
- Export log to PDF/CSV
- Evidence preview thumbnails
- Bulk operations
- Action templates

### Nice-to-Have
- Status change confirmations
- Drag-to-reorder implementation
- Activity feed integration
- Mobile responsive optimizations

---

## Files Summary

### New Files (7)
```
frontend/src/ui/atoms/Skeleton.tsx
frontend/src/ui/atoms/EmptyState.tsx
frontend/src/ui/composites/LogSidebarFilters.tsx
frontend/src/ui/molecules/DateBucketHeader.tsx
frontend/src/hooks/useKeyboardShortcuts.ts
frontend/src/hooks/useRelativeTime.ts
docs/PR-high-priority-log-ux.md
docs/PR-medium-priority-log-polish.md
```

### Modified Files (5)
```
frontend/src/ui/atoms/Badge.tsx (count variant)
frontend/src/ui/atoms/index.ts (exports)
frontend/src/ui/composites/ProjectLogView.tsx (all features)
frontend/src/ui/composites/ProjectView.tsx (tabs + shortcuts)
frontend/src/ui/composites/index.ts (exports)
```

### Total Lines of Code
- **New:** ~800 LOC
- **Modified:** ~150 LOC
- **Documentation:** ~300 lines

---

## Success Metrics

### User Experience
- ✅ Empty state has clear CTA
- ✅ Loading state provides feedback
- ✅ Keyboard shortcuts improve efficiency
- ✅ Timestamps are human-readable
- ✅ Timeline is organized chronologically

### Developer Experience
- ✅ Reusable atoms/hooks created
- ✅ Type-safe throughout
- ✅ No new dependencies
- ✅ Consistent patterns
- ✅ Well-documented

### Performance
- ✅ Memoized grouping
- ✅ Throttled timestamp updates (60s)
- ✅ Proper cleanup (no memory leaks)
- ✅ Conditional shortcut listeners

---

## Questions & Answers

**Q: Why split into two PRs?**  
A: PR #1 provides immediate usability (loading, empty states, filters). PR #2 adds polish that can be iterated on separately.

**Q: Are these blocking for other features?**  
A: No. Both PRs are self-contained enhancements. Backend API integration can happen in parallel.

**Q: What about mobile?**  
A: Keyboard shortcuts are desktop-only but gracefully ignored on mobile. All visual improvements work cross-device.

**Q: Performance impact?**  
A: Minimal. Timestamp updates are throttled to 60s, grouping is memoized, and listeners properly cleaned up.

**Q: What if shortcuts conflict with browser/OS?**  
A: Simple number keys (1/2) are safe. ⌘K has `preventDefault()` when triggered. Can be customized if needed.
