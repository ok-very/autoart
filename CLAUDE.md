# AutoArt

Cockpit: `../CLAUDE.md` — identity, agents, skills, principles.

Reference docs (loaded by agents on dispatch, not preloaded):

- `.claude/skills/frontend.md` — Components, workspace, Dockview, Zustand
- `.claude/skills/backend.md` — Modules, Action/Event, DB, cross-service
- `.claude/skills/project.md` — Monorepo commands, nomenclature
- `docs/DESIGN.md` — Palette, typography, interaction rules

## Project State & Migration Direction

**Architecture:** autohelper (Python FastAPI, port 8100) is the local desktop service. autohelper-ui is being migrated from Preact → React. Useful panels from the autoart frontend and from `../image-metadata-parser/` are being consolidated into autohelper-ui.

**Source of record:** ClickUp is being constructed as the new source of record. Autohelper manages local filesystem + manifests with review decisions. Output eventually deploys to ClickUp (data) and OneDrive (files).

**image-metadata-parser** (`../image-metadata-parser/web/`): Standalone prototype with a manifest-driven review engine. Key reusable pieces:
- `src/engine/` — types, stores, hooks, panels, components (self-contained)
- Manifest schema (`engine/types/manifest.ts`) drives all UI: fields, filters, tallies, preview, imagePipeline, assignments, confirmation
- Review store (`engine/stores/reviewStore.ts`) — Zustand with localStorage persist, scoped by manifest ID
- Three Dockview panels: ListPanel, PreviewPanel, DetailPanel
- Image serving via `/api/image?path=` proxy endpoint
- UI atoms: Button, Badge, Card, Spinner, RadioGroup, FilterChip, Label, TextInput

**autohelper-ui** (`apps/autohelper-ui/`): Currently Preact multi-page app (Directory, Health, Recon, Settings). Being migrated to React. Pages served as static files by autohelper Python service via dashboard_router.

**autohelper Python** (`apps/autohelper/`): Already has `/config/select-folder` (tkinter folder picker), `/artists` CRUD, filesystem scanner. Does NOT yet have an image-serving endpoint — needs one for the Submissions panel.
