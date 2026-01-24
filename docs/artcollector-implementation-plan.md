# ArtCollector Module Implementation Plan

## Multi-Session Reminders

> **IMPORTANT**: This plan spans multiple sessions. When resuming work:
> 1. Read this plan file first to understand current progress
> 2. Check completed phases in Implementation Order table below
> 3. Reuse styling patterns from existing wizard (references below)
> 4. Follow the established component/context pattern

---

## Styling Reference Files (REUSE THESE)

These files contain styling patterns and component structures to follow:

| Reference | Path | What to Reuse |
|-----------|------|---------------|
| **Wizard Layout** | [MondayImportWizardView.tsx](frontend/src/workflows/import/wizard/MondayImportWizardView.tsx) | Progress bar, step orchestration, context provider pattern |
| **Step Component** | [Step3Columns.tsx](frontend/src/workflows/import/wizard/steps/Step3Columns.tsx) | Card layouts, category sections, collapsible groups, footer buttons |
| **Context Provider** | [ImportContextProvider.tsx](frontend/src/workflows/import/context/ImportContextProvider.tsx) | Shared wizard state pattern |
| **Tearsheet Layout** | [demo-tearsheet.html](ref/demo-tearsheet.html) | Print-ready layout, CSS variables, grid structure |

### Key UI Components from `@autoart/ui`:
```typescript
import {
  Stack, Card, Text, ProgressBar, Inline, Button, Badge, Select,
  Spinner, CollapsibleRoot, CollapsibleTrigger, CollapsibleContent
} from '@autoart/ui';
```

### Consistent Styling Classes:
- **Header**: `bg-white border-b border-slate-200 px-6 py-4`
- **Content Area**: `flex-1 overflow-auto p-6`
- **Card**: `border border-slate-200 rounded-lg bg-white shadow-sm`
- **Footer**: `Inline justify="between" className="pt-4 mt-4 border-t border-slate-200 shrink-0"`
- **Section Header**: `bg-slate-50 flex items-center justify-between hover:bg-slate-100`
- **Sample Value Chips**: `text-sm bg-white px-2.5 py-1 rounded border border-slate-200 shadow-sm`

---

## Overview

Create an **ArtCollector** wizard module that streams files from Playwright/Puppeteer (via AutoHelper backend or proxy), allows real-time review and selection during streaming, processes text and slugs, and produces layouts using `justified-layout`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ArtCollector Wizard (4 Steps)                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ Step 1: Source Input     │ URL or folder path                              │
│ Step 2: Stream & Review  │ Real-time preview gallery, select/discard       │
│ Step 3: Text & Slugs     │ Edit text + generate slugs (combined step)      │
│ Step 4: Tearsheet Builder│ justified-layout preview, export options        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## New Dependencies

```bash
npm install @browser.style/print-preview --save
# use-justified-layout already pulled into project at /use-justified-layout
# Link or copy lib/ to frontend, or import directly
```

**Note**: AutoHelper must be running - no browser-based fallback.

---

## use-justified-layout Integration

The package is already in the repo at `use-justified-layout/`. Use the hook directly:

```typescript
import useJustifiedLayout from '../../use-justified-layout/lib/main';

// Input: array of { width, height } objects
const images = artifacts.map(a => ({
  width: a.metadata?.width || 800,
  height: a.metadata?.height || 600,
  id: a.ref_id,  // Keep reference
}));

const [layout, layoutIsReady] = useJustifiedLayout({
  layoutInput: images,
  configuration: {
    containerWidth: pageWidth,      // Adjust for page size
    targetRowHeight: 200,
    boxSpacing: 8,
    maxNumRows: maxRowsPerPage,     // Limit for pagination
  },
  dependencies: [shuffleSeed],      // Recalculate on shuffle
});

// Render with absolute positioning
{layout.boxes.map(({ width, height, top, left }, index) => (
  <img
    key={images[index].id}
    width={width}
    height={height}
    style={{ position: 'absolute', top, left }}
    src={images[index].thumbnailUrl}
  />
))}
```

### "Shake" / Shuffle Feature

Seeded random shuffle to reorganize layout order:

```typescript
// utils/seededShuffle.ts
function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];
  let m = result.length;

  // Simple seeded PRNG (mulberry32)
  const random = () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  while (m) {
    const i = Math.floor(random() * m--);
    [result[m], result[i]] = [result[i], result[m]];
  }
  return result;
}

// In component:
const [shuffleSeed, setShuffleSeed] = useState(Date.now());
const shuffledImages = useMemo(
  () => seededShuffle(images, shuffleSeed),
  [images, shuffleSeed]
);

// Shake button
<Button onClick={() => setShuffleSeed(Date.now())}>
  🎲 Shake
</Button>
```

---

## Step-by-Step Implementation

### Step 1: Source Input

**Purpose**: Accept URL or folder path, validate, initiate collection

**Layout**: BaseWeb-style dropzone with mode tabs (see https://baseweb.design/components/file-uploader/)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 1: Select Source                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│     [  Web URL  ] [  Local Folder  ]         ← Mode toggle tabs            │
│                                                                             │
│   ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │
│   │                                                                     │   │
│   │         📁  Drop folder here or click to browse                    │   │
│   │                                                                     │   │
│   │         ─────────────────── or ───────────────────                 │   │
│   │                                                                     │   │
│   │         [                          ] [Browse...]                   │   │
│   │             Paste folder path                                      │   │
│   │                                                                     │   │
│   └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │
│                                                                             │
│   ─────────────────────────────────────────────────────────────────────────│
│                                                                 [Next →]    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Dropzone Styling** (reuse from existing components):

```typescript
// Base dropzone - from FileUpload.tsx and Step2ConfigureMapping.tsx
<div
  className={clsx(
    'border-2 border-dashed rounded-lg p-8 text-center transition-all',
    isDragOver
      ? 'border-blue-400 bg-blue-50'
      : 'border-slate-300 hover:border-slate-400 bg-white/50'
  )}
  onDragOver={handleDragOver}
  onDrop={handleDrop}
>
  {/* Icon */}
  <FolderOpen className="w-12 h-12 mx-auto mb-4 text-slate-400" />

  {/* Primary action */}
  <Text weight="medium" className="mb-2">
    Drop folder here or <span className="text-blue-600 cursor-pointer">browse</span>
  </Text>

  {/* Divider */}
  <div className="flex items-center gap-3 my-4">
    <div className="flex-1 border-t border-slate-200" />
    <Text size="xs" color="muted">or paste path</Text>
    <div className="flex-1 border-t border-slate-200" />
  </div>

  {/* Path input */}
  <Inline gap="sm">
    <Input
      placeholder="C:\path\to\folder or /home/user/images"
      className="flex-1"
    />
    <Button variant="secondary" onClick={openFolderDialog}>Browse...</Button>
  </Inline>
</div>
```

**Web URL Mode** (alternative tab):

```typescript
<div className="border-2 border-dashed rounded-lg p-8 text-center border-slate-300 bg-white/50">
  <Globe className="w-12 h-12 mx-auto mb-4 text-slate-400" />
  <Text weight="medium" className="mb-4">Enter artist page URL</Text>
  <Input
    placeholder="https://gallery.com/artist/brian-jungen"
    className="w-full max-w-md mx-auto"
  />
  <Text size="xs" color="muted" className="mt-2">
    AutoHelper will crawl the page and extract artwork images
  </Text>
</div>
```

**Styling References** (reuse these patterns):

- [FileUpload.tsx:156-162](frontend/src/intake/components/blocks/FileUpload.tsx#L156-L162) - Dashed border dropzone
- [Step2ConfigureMapping.tsx:376-378](frontend/src/workflows/import/wizard/steps/Step2ConfigureMapping.tsx#L376-L378) - Drop zone placeholder

**Files**:

- `frontend/src/workflows/artcollector/steps/Step1Source.tsx`
- `frontend/src/workflows/artcollector/components/SourceDropzone.tsx`

---

### Step 2: Stream & Review (Core Feature)

**Purpose**: Stream incoming artifacts in real-time, allow select/discard before proceeding

**SSE Integration**:
```typescript
// Use existing /runner/invoke/stream endpoint
const eventSource = new EventSource('/api/runner/invoke/stream', {
  method: 'POST',
  body: JSON.stringify({ runner_id: 'autocollector', config, output_folder }),
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'artifact') {
    // Add to gallery as it arrives
    addArtifact(data.artifact);
  } else if (data.type === 'progress') {
    updateProgress(data.stage, data.percent);
  }
};
```

**Gallery Component**:
```typescript
interface ArtifactPreview {
  ref_id: string;
  path: string;
  thumbnailUrl: string;  // Generated on-the-fly or from backend
  artifact_type: 'image' | 'text' | 'document';
  selected: boolean;     // User selection state
  metadata?: {
    width?: number;
    height?: number;
    size?: number;
  };
}
```

**UI Elements**:
- Progressive image grid (images appear as they stream in)
- Checkbox overlay on each image for select/deselect
- "Select All" / "Deselect All" bulk actions
- Progress bar showing collection progress
- Real-time count: "12 of ~50 collected, 8 selected"

**Files**:
- `frontend/src/workflows/artcollector/steps/Step2StreamReview.tsx`
- `frontend/src/workflows/artcollector/components/StreamingGallery.tsx`
- `frontend/src/workflows/artcollector/components/ArtifactCard.tsx`
- `frontend/src/workflows/artcollector/hooks/useArtifactStream.ts`

---

### Step 3: Text & Slugs (Combined Step)

**Purpose**: Edit extracted text, prune unwanted elements, and generate/override slugs - all in one view.

**Layout**: Two-panel split view (collapsible sections like Step3Columns.tsx)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 3: Text & Slugs                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ ▼ Text Elements (bio, captions, alt text)                      [3 items]   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ "Artist bio paragraph from page..."          [Edit] [Delete]        │   │
│   │ "Caption: Untitled, 2020"                    [Edit] [Delete]        │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│ ▼ Image Slugs                                                  [12 items]  │
│   ┌───────────┬─────────────────────┬──────────────────────────┬────────┐   │
│   │ Thumbnail │ Auto-Generated Slug │ Override (optional)      │ Status │   │
│   ├───────────┼─────────────────────┼──────────────────────────┼────────┤   │
│   │   [img]   │ untitled-2020       │ [                      ] │   ✓    │   │
│   │   [img]   │ landscape-oil       │ [custom-name           ] │   ✓    │   │
│   │   [img]   │ portrait-01         │ [                      ] │   ⚠ dup│   │
│   └───────────┴─────────────────────┴──────────────────────────┴────────┘   │
│                                                    [Regenerate All Slugs]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Text Section**:
- Collapsible list of text snippets with source attribution
- Inline edit capability (click to edit)
- Delete button per item
- "Keep All" / "Remove All" bulk actions

**Slugs Section**:
- Table with thumbnail preview, auto-slug, override input
- Duplicate slug warning indicators (⚠ badge)
- "Regenerate All" button
- Bulk prefix/suffix options (optional)

**Slug Generation Logic**:
```typescript
function generateSlug(artifact: ArtifactPreview, index: number): string {
  // Use extracted text, filename, or fallback to index
  const baseName = artifact.metadata?.title
    || path.basename(artifact.path, path.extname(artifact.path))
    || `image-${index + 1}`;

  return slugify(baseName, { lower: true, strict: true });
}
```

**Files**:
- `frontend/src/workflows/artcollector/steps/Step3TextSlugs.tsx`
- `frontend/src/workflows/artcollector/components/TextPruningSection.tsx`
- `frontend/src/workflows/artcollector/components/SlugEditorSection.tsx`

---

### Step 4: Tearsheet Builder

**Purpose**: Create print-ready tearsheets matching `ref/demo-tearsheet.html` layout

**Target Layout** (Landscape Letter):

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ TEARSHEET (Landscape 11" x 8.5", aspect-ratio: 11/8.5)                     │
├──────────────────────────┬──────────────────────────────────────────────────┤
│ Artist Info (320px)      │ Gallery Grid (flex, 3 cols x 2 rows)            │
│ (no dividing line)       │                                                  │
│                          │  ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│ ARTIST NAME              │  │  img 1  │ │  img 2  │ │  img 3  │            │
│ (Region)                 │  └─────────┘ └─────────┘ └─────────┘            │
│                          │  Title (bold italic)                            │
│ Bio paragraph 1...       │  Year                                           │
│ Bio paragraph 2...       │                                                  │
│ Bio paragraph 3...       │  ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│                          │  │  img 4  │ │  img 5  │ │  img 6  │            │
│ ─────────────────────    │  └─────────┘ └─────────┘ └─────────┘            │
│ Contact (margin-top:auto)│  Title        Title        Title                │
│ website.com              │  Year         Year         Year                 │
└──────────────────────────┴──────────────────────────────────────────────────┘
```

**Key Styles from demo (NO border-right, text floats at top)**:
- Container: `grid-template-columns: 320px 1fr`, gap `40px`, padding `40px`
- Sidebar: NO `border-right`, bio text `11pt` justified, contact pushed to bottom
- Gallery: CSS Grid `repeat(3, 1fr)` x `repeat(2, 1fr)`, gap `20px`
- Captions: Title in `<span class="artwork-title">` (bold, italic) + Year
- Font: Carlito (Calibri-compatible), `--font-main`

**Editor Architecture** (No sidebar - controls in toolbar/inline):

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Toolbar: [Page 1/12 ◀ ▶] [🎲 Shuffle] [Export PDF] [Export Records]        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   TEARSHEET PREVIEW (Full Width, Interactive)                              │
│   ┌──────────────────────────────────────────────────────────────────────┐ │
│   │ ┌──────────────┐  ┌──────────────────────────────────────────────┐   │ │
│   │ │ ARTIST NAME  │  │  ┌─────┐ ┌─────┐ ┌─────┐                    │   │ │
│   │ │ (Region)     │  │  │ img │ │ img │ │ img │  ← click to select │   │ │
│   │ │              │  │  └─────┘ └─────┘ └─────┘    double-click    │   │ │
│   │ │ Bio text...  │  │  Title    Title    Title    to remove       │   │ │
│   │ │ [editable]   │  │                                              │   │ │
│   │ │              │  │  ┌─────┐ ┌─────┐ ┌─────┐                    │   │ │
│   │ │              │  │  │ img │ │ img │ │ img │  ← drag to reorder │   │ │
│   │ │ Contact      │  │  └─────┘ └─────┘ └─────┘                    │   │ │
│   │ └──────────────┘  └──────────────────────────────────────────────┘   │ │
│   └──────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│   AVAILABLE IMAGES (justified-layout, drag to add to page above)           │
│   ┌──────────────────────────────────────────────────────────────────────┐ │
│   │ [img] [img] [img] [img] [img] [img] [img] [img] ...                  │ │
│   └──────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**@browser.style/print-preview + use-justified-layout Integration**:

```typescript
import { PrintPreview } from '@browser.style/print-preview';
import useJustifiedLayout from '../../use-justified-layout/lib/main';

// Page dimensions (letter size in pixels at 96 DPI)
const PAGE_SIZES = {
  letter: { width: 816, height: 1056 },  // 8.5" x 11"
  a4: { width: 794, height: 1123 },      // 210mm x 297mm
};

// Calculate layout constrained to page
const pageConfig = PAGE_SIZES[pageSize];
const contentWidth = pageConfig.width - margins.left - margins.right;
const contentHeight = pageConfig.height - margins.top - margins.bottom;

// Shuffle images with current seed
const shuffledImages = seededShuffle(pageImages, shuffleSeed);

const [layout] = useJustifiedLayout({
  layoutInput: shuffledImages,
  configuration: {
    containerWidth: contentWidth,
    targetRowHeight: Math.floor(contentHeight / 3),  // ~3 rows per page
    boxSpacing: 12,
  },
  dependencies: [shuffleSeed, pageSize],
});

// Wrap in print-preview
<PrintPreview pageSize={pageSize} orientation={orientation} margins={margins}>
  <div style={{ position: 'relative', height: layout.containerHeight }}>
    {layout.boxes.map((box, i) => (
      <TearsheetImage
        key={shuffledImages[i].id}
        box={box}
        image={shuffledImages[i]}
        onRemove={() => removeFromPage(shuffledImages[i].id)}
      />
    ))}
  </div>
</PrintPreview>

// Shake button in sidebar
<Button variant="outline" onClick={() => setShuffleSeed(Date.now())}>
  🎲 Shuffle Layout
</Button>
```

**UI Elements**:

- **Toolbar** (top):
  - Page navigator: `[◀] Page 1 of 12 [▶]`
  - Shuffle button: `🎲 Shuffle`
  - Export PDF button (opens @browser.style/print-preview dialog)
  - Export Records button

- **Tearsheet Preview** (center, full width):
  - Live preview matching demo-tearsheet.html layout
  - Inline editable: artist name, region, bio text
  - Gallery grid: drag-to-reorder images
  - Click image to select, double-click to remove
  - Images have captions (title + year) editable inline

- **Available Images** (bottom strip):
  - justified-layout horizontal gallery of unplaced images
  - Drag images up to add to current page

- **Export (via @browser.style/print-preview)**:
  - Print dialog with page setup
  - Export to PDF
  - Export to Records (creates database entries)

**Files**:

- `frontend/src/workflows/artcollector/steps/Step4Tearsheet.tsx`
- `frontend/src/workflows/artcollector/components/TearsheetPreview.tsx`
- `frontend/src/workflows/artcollector/components/TearsheetToolbar.tsx`
- `frontend/src/workflows/artcollector/components/AvailableGallery.tsx`
- `frontend/src/workflows/artcollector/utils/tearsheetExport.ts`

---

## Backend Enhancements

### 1. Thumbnail Generation Endpoint

```typescript
// backend/src/modules/runner/thumbnails.routes.ts
app.get('/runner/thumbnail/:artifactId', async (req, reply) => {
  // Generate/cache thumbnail for artifact
  // Return resized image (300px max dimension)
});
```

### 2. Artifact Metadata Extraction

```typescript
// Extend autocollector.py to emit image dimensions
{
  "type": "artifact",
  "artifact": {
    "ref_id": "uuid",
    "path": "/path/to/image.jpg",
    "artifact_type": "image",
    "metadata": {
      "width": 1920,
      "height": 1080,
      "size_bytes": 245000
    }
  }
}
```

### 3. Runner Parser for Import Pipeline

```typescript
// backend/src/modules/imports/parsers/runner-parser.ts
export class RunnerParser implements Parser {
  parse(rawData: string, config: Record<string, unknown>) {
    const artifacts = JSON.parse(rawData);
    return {
      containers: [/* ... */],
      items: artifacts.map(a => ({
        tempId: a.ref_id,
        title: a.slug || path.basename(a.path),
        entityType: 'record',
        // ...
      })),
      validationIssues: [],
    };
  }
}
```

---

## File Structure

```text
frontend/src/workflows/artcollector/
├── wizard/
│   └── ArtCollectorWizardView.tsx      # Main wizard orchestrator (see MondayImportWizardView.tsx)
├── steps/
│   ├── Step1Source.tsx                 # URL/folder input
│   ├── Step2StreamReview.tsx           # Streaming gallery with select
│   ├── Step3TextSlugs.tsx              # Combined text editing + slug generation
│   └── Step4Tearsheet.tsx              # Print-preview tearsheet builder
├── components/
│   ├── StreamingGallery.tsx            # Real-time image grid (Step 2)
│   ├── ArtifactCard.tsx                # Selectable image card
│   ├── TextPruningSection.tsx          # Collapsible text editor (Step 3)
│   ├── SlugEditorSection.tsx           # Slug table with overrides (Step 3)
│   ├── TearsheetPreview.tsx            # Tearsheet layout component (Step 4)
│   ├── TearsheetToolbar.tsx            # Page nav + shuffle + export buttons
│   └── AvailableGallery.tsx            # Justified gallery of unplaced images
├── hooks/
│   ├── useArtifactStream.ts            # SSE stream handler
│   └── useTearsheetState.ts            # Multi-page state management
├── context/
│   └── ArtCollectorContext.tsx         # Shared wizard state (see ImportContextProvider.tsx)
├── types.ts                            # Type definitions
└── utils/
    ├── slugify.ts                      # Slug generation
    ├── seededShuffle.ts                # Deterministic shuffle for "shake"
    └── tearsheetExport.ts              # PDF/Records export
```

---

## State Management

```typescript
interface ArtCollectorState {
  // Step 1: Source Input
  sourceType: 'web' | 'local';
  sourceUrl: string;
  sourcePath: string;

  // Step 2: Stream & Review
  artifacts: ArtifactPreview[];
  selectedIds: Set<string>;
  isStreaming: boolean;
  streamProgress: { stage: string; percent: number };

  // Step 3: Text & Slugs (combined)
  textElements: TextElement[];
  prunedTextIds: Set<string>;
  slugOverrides: Map<string, string>;  // artifactId -> custom slug

  // Step 4: Tearsheet State
  tearsheet: {
    pages: TearsheetPage[];           // Array of pages, each with image refs
    currentPageIndex: number;
    pageSize: 'letter' | 'a4' | 'custom';
    orientation: 'portrait' | 'landscape';
    margins: { top: number; right: number; bottom: number; left: number };
    shuffleSeed: number;              // Seed for deterministic shuffle
  };
  availableImages: string[];          // IDs not yet placed on any page
}

interface TearsheetPage {
  id: string;
  imageRefs: string[];                // Ordered list of artifact IDs on this page
  shuffleSeed: number;                // Per-page shuffle seed for "shake"
}
```

---

## Panel Registration

```typescript
// frontend/src/workspace/panelRegistry.ts
export const PANEL_DEFINITIONS: Record<PanelId, PanelDefinition> = {
  // ... existing panels
  'artcollector-workbench': {
    title: 'Art Collector',
    icon: ImageIcon,
    component: lazy(() => import('../workflows/artcollector/wizard/ArtCollectorWizardView')),
    defaultPlacement: { area: 'center' },
  },
};
```

---

## Workspace Preset

```typescript
// frontend/src/workspace/workspacePresets.ts
{
  id: 'collect',
  label: '0. Collect',
  icon: ImageIcon,
  color: 'cyan',
  scope: 'global',
  isBuiltIn: true,
  panels: [
    { panelId: 'artcollector-workbench', position: 'center' },
    { panelId: 'selection-inspector', position: 'right' },
  ],
},
```

---

## Verification Checklist

1. **Step 1**: Enter URL → validates → triggers collection (AutoHelper required)
2. **Step 2**: Images stream in progressively → can select/deselect → count updates
3. **Step 3**: Text elements editable + slugs auto-generated → can override → duplicates flagged
4. **Step 4**: Tearsheet preview renders → pages navigable → shuffle works → can add/remove images
5. **Export**: Export to Records creates database entries with slugs and metadata
6. **Export**: Export PDF generates printable tearsheets

---

## Implementation Order

| Phase | Tasks | Priority | Status |
|-------|-------|----------|--------|
| 1 | Install @browser.style/print-preview, link use-justified-layout | High | ✅ |
| 2 | Create file structure, types.ts, ArtCollectorContext.tsx | High | ✅ |
| 3 | Implement ArtCollectorWizardView.tsx (wizard shell) | High | ✅ |
| 4 | Implement Step1Source.tsx | High | ✅ |
| 5 | Implement useArtifactStream.ts hook (SSE) | High | ✅ |
| 6 | Implement Step2StreamReview.tsx + StreamingGallery | High | ✅ |
| 7 | Backend: thumbnail endpoint + metadata extraction | Medium | ⬜ |
| 8 | Implement Step3TextSlugs.tsx (combined text + slugs) | Medium | ✅ |
| 9 | Implement Step4Tearsheet.tsx + TearsheetPreview | High | ✅ |
| 10 | Implement Export to Records | High | ✅ |
| 11 | Implement Export PDF via Tailwind print utilities | Medium | ✅ |
| 12 | Panel registration + workspace preset | Low | ✅ |

> **Session Progress**: Update ⬜ to ✅ as phases complete. Copy incomplete phases to next session.

---

## Phase 2: Artifact Naming, Numbering & Persistent ID System

### Investigation Summary (2026-01-23)

#### Current Frontend-Backend Linkage

| Component | Implementation | File |
|-----------|----------------|------|
| **Start Crawl** | `POST /api/runner/invoke/stream` with `{runner_id: 'autocollector', config}` | [useArtifactStream.ts:86-107](frontend/src/workflows/artcollector/hooks/useArtifactStream.ts#L86-L107) |
| **Cancel Crawl** | `AbortController.abort()` on fetch request | [useArtifactStream.ts:67-74](frontend/src/workflows/artcollector/hooks/useArtifactStream.ts#L67-L74) |
| **Receive Images** | SSE events with type `artifact`, parsed and normalized | [useArtifactStream.ts:183-215](frontend/src/workflows/artcollector/hooks/useArtifactStream.ts#L183-L215) |
| **Storage Endpoint** | Not currently configurable - uses `output_folder` param (backend validates) | Backend validation in runner.routes.ts |
| **Temp Files** | Images saved to `output_folder` with pattern `image_{index:03d}_{hash}.{ext}` | [autocollector.py:570-572](apps/autohelper/autohelper/modules/runner/autocollector.py#L570-L572) |

#### Current ID System Gaps

1. **ref_id is ephemeral**: Generated fresh as `uuid.uuid4()` on every collection
2. **No manifest file**: Artifacts not tracked persistently
3. **No content hashing**: Can't find moved files
4. **No naming config**: Template is hardcoded

---

### New Feature 1: Naming Pattern Configuration

#### Data Models

**Backend (types.py)**:
```python
class NamingConfig(BaseModel):
    template: str = "{index}_{hash}"  # Template syntax
    index_start: int = 1
    index_padding: int = 3
    prefix: str = ""
    suffix: str = ""
    date_format: str = "%Y%m%d"
    numbering_mode: Literal["sequential", "by_source"] = "sequential"
```

**Template Variables** (with fallback chain):

| Variable | Source | Fallback |
|----------|--------|----------|
| `{index}` | Sequential counter | Always available |
| `{hash}` | URL/content MD5 (8 chars) | Always available |
| `{date}` | Collection timestamp | Always available |
| `{ext}` | MIME type detection | `.jpg` |
| `{artist}` | Page metadata, context | `"unknown-artist"` |
| `{title}` | Alt text, filename, caption | `"untitled-{index}"` |
| `{source}` | Hostname or folder name | `"local"` |

**Fallback Logic** (autocollector.py):
```python
def resolve_template_var(var: str, context: dict, index: int) -> str:
    match var:
        case "artist":
            return context.get("artist") or context.get("page_author") or "unknown-artist"
        case "title":
            return (context.get("alt_text") or
                    context.get("caption") or
                    context.get("filename_stem") or
                    f"untitled-{index}")
        case _:
            return context.get(var, "")
```

**Frontend (types.ts)**:
```typescript
interface NamingConfig {
  template: string;
  indexStart: number;
  indexPadding: number;
  prefix: string;
  suffix: string;
  dateFormat: string;
  numberingMode: 'sequential' | 'by_source';
}
```

#### UI Location

Add collapsible "Advanced Settings" panel to Step1Source.tsx with:
- Template input with preview
- Start index (number input)
- Padding width (dropdown: 2, 3, 4)
- Prefix/suffix text inputs

---

### New Feature 2: Image Numbering Schema

**IndexCounter Class** (autocollector.py):
```python
class IndexCounter:
    def __init__(self, start: int = 1, mode: str = "sequential"):
        self.start = start
        self.mode = mode
        self._global = start - 1
        self._by_source: dict[str, int] = {}

    def next(self, source_key: str | None = None) -> int:
        if self.mode == "sequential":
            self._global += 1
            return self._global
        else:
            key = source_key or "default"
            self._by_source.setdefault(key, self.start - 1)
            self._by_source[key] += 1
            return self._by_source[key]
```

**Integration**: Passed via `config.naming_config` in InvokeRequest

---

### New Feature 3: Persistent ID Tagging

#### User Preferences (confirmed)
- **Config UI**: Step 1 Advanced Settings (collapsible panel)
- **Primary Storage**: JSON manifest (local, always available)
- **Secondary Storage**: SharePoint via PnP Python library (optional, requires config)
- **Template Variables**: `{artist}`, `{title}` with fallbacks if none scraped

#### Approach: Pluggable Metadata Storage with Configurable Backends

**Metadata Storage Backend Interface**:
```python
# apps/autohelper/autohelper/modules/storage/base.py
from abc import ABC, abstractmethod
from typing import Protocol

class MetadataStorageBackend(Protocol):
    """Protocol for artifact metadata storage backends."""

    @abstractmethod
    async def save_artifact(self, artifact: ArtifactManifestEntry) -> None:
        """Save artifact metadata."""
        ...

    @abstractmethod
    async def find_by_id(self, artifact_id: str) -> dict | None:
        """Find artifact by persistent ID."""
        ...

    @abstractmethod
    async def find_by_hash(self, content_hash: str) -> list[dict]:
        """Find artifacts by content hash (for relocated files)."""
        ...

    @abstractmethod
    async def update_location(self, artifact_id: str, new_path: str) -> None:
        """Update artifact location after move detection."""
        ...

    @abstractmethod
    async def save_collection(self, manifest: CollectionManifest) -> None:
        """Save full collection manifest."""
        ...
```

**Backend Handles** (configurable in settings):

| Handle       | Backend       | Description                                    |
|--------------|---------------|------------------------------------------------|
| `manifest`   | JSON Manifest | Local `.artcollector/manifest.json` (default)  |
| `sharepoint` | SharePoint    | PnP Python to SharePoint list (optional)       |

**Primary Backend: JSON Manifest** (default, always available):

**Location**: `{output_folder}/.artcollector/manifest.json`

```python
# apps/autohelper/autohelper/modules/storage/manifest_backend.py
class ManifestStorageBackend:
    """JSON manifest-based metadata storage (default)."""

    def __init__(self, output_folder: str):
        self.manifest_dir = Path(output_folder) / ".artcollector"
        self.manifest_path = self.manifest_dir / "manifest.json"

    async def save_artifact(self, artifact: ArtifactManifestEntry) -> None:
        manifest = await self._load_or_create()
        manifest.artifacts.append(artifact)
        await self._save(manifest)

    async def find_by_id(self, artifact_id: str) -> dict | None:
        manifest = await self._load_or_create()
        return next((a for a in manifest.artifacts if a.artifact_id == artifact_id), None)

    # ... other methods
```

**Secondary Backend: SharePoint** (optional, requires credentials):
```python
# apps/autohelper/autohelper/modules/storage/sharepoint_backend.py
from office365.runtime.auth.client_credential import ClientCredential
from office365.sharepoint.client_context import ClientContext

class SharePointStorageBackend:
    """SharePoint-based metadata storage (optional)."""

    def __init__(self, site_url: str, client_id: str, client_secret: str):
        self.ctx = ClientContext(site_url).with_credentials(
            ClientCredential(client_id, client_secret)
        )
        self.list_name = "ArtifactCollections"

    async def save_artifact(self, artifact: ArtifactManifestEntry) -> None:
        """Upload artifact metadata to SharePoint list."""
        # Create list item with artifact metadata
        ...

    async def find_by_id(self, artifact_id: str) -> dict | None:
        """Query SharePoint list by artifact_id."""
        # CAML query on ArtifactCollections list
        ...

    async def update_location(self, artifact_id: str, new_path: str) -> None:
        """Update artifact location in SharePoint."""
        ...
```

**Settings Configuration** (AutoHelper config):
```python
# apps/autohelper/autohelper/config/settings.py
from typing import Literal

class ArtifactStorageSettings(BaseModel):
    # Backend selection
    metadata_backend: Literal["manifest", "sharepoint"] = "manifest"

    # SharePoint settings (only used if metadata_backend == "sharepoint")
    sharepoint_site_url: str | None = None
    sharepoint_client_id: str | None = None
    sharepoint_client_secret: str | None = None
```

**Storage Router** (selects backend based on config):
```python
# apps/autohelper/autohelper/modules/storage/router.py
def get_metadata_backend(settings: ArtifactStorageSettings, output_folder: str) -> MetadataStorageBackend:
    """Factory function to get configured metadata backend."""
    match settings.metadata_backend:
        case "manifest":
            return ManifestStorageBackend(output_folder)
        case "sharepoint":
            if not all([settings.sharepoint_site_url, settings.sharepoint_client_id, settings.sharepoint_client_secret]):
                raise ValueError("SharePoint backend requires site_url, client_id, and client_secret")
            return SharePointStorageBackend(
                settings.sharepoint_site_url,
                settings.sharepoint_client_id,
                settings.sharepoint_client_secret
            )
        case _:
            raise ValueError(f"Unknown metadata backend: {settings.metadata_backend}")
```

**Manifest Schema**:
```python
class ArtifactManifestEntry(BaseModel):
    artifact_id: str           # Stable UUID (content-based)
    original_filename: str
    current_filename: str      # Updated if renamed
    content_hash: str          # SHA-256 for relocation
    source_url: str | None
    source_path: str | None
    collected_at: str          # ISO timestamp
    mime_type: str
    size: int
    metadata: dict

class CollectionManifest(BaseModel):
    manifest_id: str
    version: str = "1.0"
    created_at: str
    updated_at: str
    source_type: str
    output_folder: str
    naming_config: NamingConfig
    artifacts: list[ArtifactManifestEntry]
```

**Persistent ID Generation**:
```python
def generate_persistent_id(content: bytes, source: str, timestamp: str) -> str:
    content_hash = hashlib.sha256(content).hexdigest()
    id_input = f"{content_hash}:{source}:{timestamp}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, id_input))
```

#### Artifact Lookup Service

**Find by ID (even if moved)**:
1. Search manifests in all `allowed_roots`
2. Find entry by `artifact_id`
3. Check expected path from `current_filename`
4. If missing, search by `content_hash` in files table
5. Update manifest with new location if found

**New API Endpoints**:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/runner/artifacts/{id}` | GET | Lookup artifact by persistent ID |
| `/runner/collections` | GET | List all artifact collections |
| `/runner/collections/{id}` | GET | Get collection manifest |

---

### Database Migration (AutoHelper)

```sql
-- New tables for artifact tracking
CREATE TABLE artifact_collections (
    collection_id TEXT PRIMARY KEY,
    manifest_path TEXT UNIQUE NOT NULL,
    source_type TEXT NOT NULL,
    source_url TEXT,
    source_path TEXT,
    output_folder TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    artifact_count INTEGER DEFAULT 0
);

CREATE TABLE collected_artifacts (
    artifact_id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL REFERENCES artifact_collections,
    file_id TEXT REFERENCES files ON DELETE SET NULL,
    content_hash TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    current_filename TEXT NOT NULL,
    collected_at TEXT NOT NULL,
    metadata_json TEXT
);

CREATE INDEX idx_artifacts_hash ON collected_artifacts(content_hash);
```

---

### Implementation Phases

| Phase | Tasks | Priority | Status |
|-------|-------|----------|--------|
| 13 | Add NamingConfig models to types.py | High | ✅ |
| 14 | Create MetadataStorageBackend protocol in storage/base.py | High | ✅ |
| 15 | Create manifest.py with CollectionManifest schema | High | ✅ |
| 16 | Implement ManifestStorageBackend (default, JSON-based) | High | ✅ |
| 17 | Implement _generate_filename() with template + fallbacks | High | ✅ |
| 18 | Integrate manifest backend into autocollector.py | High | ✅ |
| 19 | Add ArtifactStorageSettings to config (metadata_backend handle) | Medium | ✅ |
| 20 | Implement storage router (get_metadata_backend factory) | High | ✅ |
| 21 | Add `office365-rest-python-client` dependency | Low | ⬜ |
| 22 | Create SharePointStorageBackend (optional secondary) | Low | ⬜ |
| 23 | Add database migration for artifact_collections | Medium | ⬜ |
| 24 | Implement ArtifactLookupService (queries configured backend) | Medium | ⬜ |
| 25 | Add lookup API endpoints to runner router | Medium | ⬜ |
| 26 | Add NamingConfig to frontend types and context | High | ✅ |
| 27 | Build NamingConfigPanel component | Medium | ✅ |
| 28 | Update Step1Source with advanced settings | Medium | ✅ |
| 29 | Update useArtifactStream to pass naming config | High | ✅ |
| 30 | Update ArtifactPreview to include artifact_id | Medium | ✅ |

---

### Critical Files for Phase 2

| File | Changes |
|------|---------|
| `apps/autohelper/autohelper/modules/runner/types.py` | Add NamingConfig, NumberingMode models |
| `apps/autohelper/autohelper/modules/storage/base.py` | **New file** - MetadataStorageBackend protocol |
| `apps/autohelper/autohelper/modules/storage/manifest_backend.py` | **New file** - JSON manifest backend (default) |
| `apps/autohelper/autohelper/modules/storage/sharepoint_backend.py` | **New file** - SharePoint backend (optional) |
| `apps/autohelper/autohelper/modules/storage/router.py` | **New file** - Backend factory/router |
| `apps/autohelper/autohelper/modules/runner/manifest.py` | **New file** - CollectionManifest schema |
| `apps/autohelper/autohelper/modules/runner/autocollector.py` | Template naming, persistent IDs, backend integration |
| `apps/autohelper/autohelper/config/settings.py` | Add ArtifactStorageSettings (metadata_backend handle) |
| `apps/autohelper/autohelper/modules/runner/service.py` | ArtifactLookupService (queries configured backend) |
| `apps/autohelper/autohelper/modules/runner/router.py` | New lookup endpoints |
| `apps/autohelper/pyproject.toml` | Add `office365-rest-python-client` (optional dep) |
| `frontend/src/workflows/artcollector/types.ts` | NamingConfig interface, update ArtifactPreview |
| `frontend/src/workflows/artcollector/context/ArtCollectorContext.tsx` | Add namingConfig state |
| `frontend/src/workflows/artcollector/steps/Step1Source.tsx` | Advanced settings panel |
| `frontend/src/workflows/artcollector/hooks/useArtifactStream.ts` | Pass naming config to backend |
| `frontend/src/workflows/artcollector/components/NamingConfigPanel.tsx` | **New file** - Template config UI |

---

### Verification for Phase 2

1. **Naming**: Collect images with custom template → verify filenames match pattern
2. **Fallbacks**: Collect without metadata → artist/title use fallback values
3. **Numbering**: Test sequential vs by_source modes, verify padding
4. **Manifest (default)**: Collect with `metadata_backend: "manifest"` → `.artcollector/manifest.json` created
5. **SharePoint (optional)**: With `metadata_backend: "sharepoint"` + credentials → metadata in SP list
6. **Backend Switch**: Change `metadata_backend` setting → new collections use new backend
7. **Persistence**: Move file → lookup by artifact_id → returns new location
8. **Backward Compat**: Collections without naming_config use default pattern

---

## Phase 3: AutoCollector Refactoring

### Current State Analysis

**File**: `apps/autohelper/autohelper/modules/runner/autocollector.py` (829 lines)

| Section | Lines | LOC | Responsibility |
|---------|-------|-----|----------------|
| Imports & Constants | 1-52 | 52 | SSRF blocklists, exception class |
| SSRF Validation | 54-152 | 98 | DNS resolution, IP range checks, URL validation |
| SSRFProtectedClient | 154-200 | 46 | HTTP client with redirect protection |
| Lazy Imports | 201-244 | 43 | Optional deps (httpx, bs4, lxml) |
| AutoCollectorRunner Core | 246-324 | 78 | Entry points, mode routing |
| Web Collection | 326-600 | 274 | HTML parsing, bio/image extraction, download |
| Folder Collection | 602-829 | 227 | Local filesystem scanning, file copying |

### Issues Identified

1. **Code Duplication**: `scan_files()` inner function duplicated at lines 638-665 and 745-772
2. **Mixed Concerns**: Security (SSRF), parsing (HTML), I/O (filesystem) all in one file
3. **Testability**: Tightly coupled - can't test extractors without HTTP mocking
4. **Maintainability**: 829 lines makes navigation difficult
5. **Extensibility**: Adding new collectors requires editing monolithic file

### Proposed Modular Structure

```
modules/runner/
├── __init__.py              # Module exports
├── types.py                 # ✅ Existing - NamingConfig, manifest types
├── naming.py                # ✅ Existing - filename generation
├── service.py               # ✅ Existing - BaseRunner protocol
├── autocollector.py         # SLIM: Orchestration only (~100 lines)
│
├── ssrf/                    # NEW: SSRF protection submodule
│   ├── __init__.py          # Exports: SSRFProtectedClient, is_safe_url
│   ├── constants.py         # BLOCKED_HOSTNAMES, PRIVATE_IP_RANGES
│   ├── validation.py        # _resolve_all_ips, _check_ips_against_private_ranges, _is_safe_url
│   └── client.py            # SSRFProtectedClient class
│
├── collectors/              # NEW: Collector implementations
│   ├── __init__.py          # Exports: WebCollector, FolderCollector
│   ├── base.py              # CollectorProtocol, shared utilities
│   ├── web.py               # WebCollector - handles web URLs
│   └── folder.py            # FolderCollector - handles local paths
│
└── extractors/              # NEW: Content extractors
    ├── __init__.py          # Exports: extract_bio_text, extract_image_urls
    ├── bio.py               # Bio/about text extraction from HTML
    └── images.py            # Image URL extraction from HTML
```

### Module Responsibilities

#### 1. `ssrf/` Submodule (~200 lines total)

**Purpose**: Reusable SSRF protection for any HTTP client usage

| File | Content | LOC |
|------|---------|-----|
| `constants.py` | `BLOCKED_HOSTNAMES`, `PRIVATE_IP_RANGES`, `DNS_TIMEOUT_SECONDS` | ~30 |
| `validation.py` | `DNSResolutionError`, `_resolve_all_ips`, `_check_ips_against_private_ranges`, `is_safe_url` | ~100 |
| `client.py` | `SSRFProtectedClient` class with redirect handling | ~60 |

**Exports**:
```python
from .validation import is_safe_url, DNSResolutionError
from .client import SSRFProtectedClient
```

#### 2. `extractors/` Submodule (~100 lines total)

**Purpose**: HTML content extraction, decoupled from HTTP fetching

| File | Content | LOC |
|------|---------|-----|
| `bio.py` | `extract_bio_text(soup) -> str` with selector configs | ~50 |
| `images.py` | `extract_image_urls(soup, base_url) -> list[str]` | ~50 |

**Exports**:
```python
from .bio import extract_bio_text
from .images import extract_image_urls
```

#### 3. `collectors/` Submodule (~350 lines total)

**Purpose**: Source-specific collection logic

| File | Content | LOC |
|------|---------|-----|
| `base.py` | `CollectorProtocol`, shared constants, `scan_files_safe()` utility | ~80 |
| `web.py` | `WebCollector` - fetch page, extract content, download images | ~150 |
| `folder.py` | `FolderCollector` - scan folder, copy files, create artifacts | ~120 |

**base.py** Protocol:
```python
from typing import Protocol, AsyncIterator

class CollectorProtocol(Protocol):
    """Protocol for artifact collectors."""

    async def collect(
        self,
        source: str,
        output_folder: Path,
        naming_config: NamingConfig,
        context_id: str | None = None,
    ) -> RunnerResult:
        """Collect artifacts from source."""
        ...

    async def collect_stream(
        self,
        source: str,
        output_folder: Path,
        naming_config: NamingConfig,
        context_id: str | None = None,
    ) -> AsyncIterator[RunnerProgress]:
        """Collect with streaming progress updates."""
        ...
```

**Shared utility** (eliminates duplication):
```python
async def scan_files_safe(source_path: Path) -> list[Path]:
    """
    Scan directory for files with symlink safety.

    - Resolves symlinks
    - Validates targets stay within source directory
    - Deduplicates files (multiple symlinks to same target)
    - Skips inaccessible files gracefully
    """
    ...
```

#### 4. Slim `autocollector.py` (~100 lines)

**Purpose**: Orchestration only - delegates to collectors

```python
class AutoCollectorRunner(BaseRunner):
    """Orchestrates web and folder collection."""

    SUPPORTED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ...}
    MAX_IMAGES = 50
    REQUEST_TIMEOUT = 30.0

    def __init__(self):
        self._web_collector = WebCollector(...)
        self._folder_collector = FolderCollector(...)

    async def invoke(self, config: dict, output_folder: Path, ...) -> RunnerResult:
        naming_config = NamingConfig(**(config.get("naming_config") or {}))

        if config.get("url"):
            return await self._web_collector.collect(
                config["url"], output_folder, naming_config
            )
        elif config.get("source_path"):
            return await self._folder_collector.collect(
                config["source_path"], output_folder, naming_config
            )
        else:
            return RunnerResult(success=False, error="...")

    async def invoke_stream(self, ...):
        # Similar delegation pattern
        ...
```

### Integration with Phase 2 Features

The refactoring integrates the naming and manifest features:

```python
# collectors/web.py
from ..naming import IndexCounter, generate_filename, generate_persistent_id, compute_content_hash
from ..storage import get_metadata_backend
from ..types import ArtifactManifestEntry, CollectionManifest, NamingConfig

class WebCollector:
    async def collect(self, url: str, output_folder: Path, naming_config: NamingConfig, ...):
        # Initialize storage backend
        backend = get_metadata_backend(output_folder)

        # Initialize index counter
        counter = IndexCounter(
            start=naming_config.index_start,
            mode=naming_config.numbering_mode
        )

        # Create manifest
        manifest = CollectionManifest(
            manifest_id=str(uuid.uuid4()),
            source_type="web",
            source_url=url,
            output_folder=str(output_folder),
            naming_config=naming_config,
            created_at=datetime.now(timezone.utc).isoformat(),
            updated_at=datetime.now(timezone.utc).isoformat(),
        )

        # ... collection logic ...

        # For each downloaded image:
        content_hash = compute_content_hash(content)
        filename = generate_filename(naming_config, context, counter.next(), ext)
        artifact_id = generate_persistent_id(content, url, timestamp)

        entry = ArtifactManifestEntry(
            artifact_id=artifact_id,
            original_filename=filename,
            current_filename=filename,
            content_hash=content_hash,
            ...
        )
        manifest.artifacts.append(entry)

        # Save manifest at end
        await backend.save_collection(manifest)
```

### Implementation Phases

| Phase | Tasks | Priority | Status |
|-------|-------|----------|--------|
| 31 | Create `ssrf/` submodule structure | High | ✅ |
| 32 | Move SSRF constants to `ssrf/constants.py` | High | ✅ |
| 33 | Move validation functions to `ssrf/validation.py` | High | ✅ |
| 34 | Move SSRFProtectedClient to `ssrf/client.py` | High | ✅ |
| 35 | Create `extractors/` submodule structure | Medium | ✅ |
| 36 | Move bio extraction to `extractors/bio.py` | Medium | ✅ |
| 37 | Move image extraction to `extractors/images.py` | Medium | ✅ |
| 38 | Create `collectors/base.py` with protocol and `scan_files_safe()` | High | ✅ |
| 39 | Create `collectors/web.py` with WebCollector | High | ✅ |
| 40 | Create `collectors/folder.py` with FolderCollector | High | ✅ |
| 41 | Refactor `autocollector.py` to use new modules | High | ✅ |
| 42 | Update imports in `router.py` and `service.py` | Medium | ⬜ |
| 43 | Add tests for SSRF submodule | Medium | ⬜ |
| 44 | Add tests for extractors | Medium | ⬜ |
| 45 | Add tests for collectors | Medium | ⬜ |

### File Size Targets (Actual Results)

| File | Target LOC | Actual LOC |
|------|------------|------------|
| `autocollector.py` | ~100 | 134 |
| `ssrf/constants.py` | ~30 | 32 |
| `ssrf/validation.py` | ~100 | 128 |
| `ssrf/client.py` | ~60 | 97 |
| `extractors/bio.py` | ~50 | 69 |
| `extractors/images.py` | ~50 | 72 |
| `collectors/base.py` | ~80 | 145 |
| `collectors/web.py` | ~180 | 404 |
| `collectors/folder.py` | ~150 | 356 |
| **Total** | ~800 | 1437 |

> **Note**: Collectors are larger than planned due to full manifest integration.
> The increased size is justified as each file handles a single concern.

### Verification for Phase 3

1. **SSRF Protection**: Existing SSRF tests pass with refactored modules
2. **Web Collection**: Collect from URL → same artifacts as before
3. **Folder Collection**: Collect from folder → same artifacts as before
4. **Symlink Safety**: Symlink escape attempts still blocked
5. **Error Handling**: Same error messages for invalid inputs
6. **Streaming**: Progress events emit correctly
7. **Manifest Integration**: Manifests created with correct naming
