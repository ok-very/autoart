# OneDrive ↔ ClickUp Sync

How files in OneDrive and task data in ClickUp stay in agreement.

## Architecture

```
OneDrive (files)          ClickUp (tasks/data)          AutoHelper (bridge)
├── Artist folders     →  Artist records + tasks    ←→  Filesystem scanner
├── Submissions/       →  Submission tasks          ←→  Image proxy
├── Email templates/   →  Email composition         ←→  Template merge
└── Project folders    →  Project structure         ←→  Config/manifest
```

**ClickUp** is the source of record for project management data (tasks, statuses, custom fields).
**OneDrive** is the source of record for files (images, documents, templates).
**AutoHelper** bridges the two — reading files from OneDrive and pushing/pulling data to/from ClickUp.

## Image Roots

Configured in autohelper settings as `image_allowed_roots`:

```json
{
  "image_allowed_roots": [
    "E:/OneDrive - Ballard Fine Art/BALLARD FINE ART - ALL FILES/3. CORPORATE ART/ALL PROJECTS/Burnaby Hospital/Special Projects/Submissions for print",
    "E:/OneDrive - Ballard Fine Art/..."
  ]
}
```

Image paths in task records are **relative** — the backend resolves them against these roots.

## BH Submissions Path

```
E:/OneDrive - Ballard Fine Art/BALLARD FINE ART - ALL FILES/3. CORPORATE ART/ALL PROJECTS/Burnaby Hospital/Special Projects/Submissions for print
```

Structure: flat directory of submission images.

## Artist Photo Submissions

```
E:/OneDrive - Ballard Fine Art/.../[Artist Name]/[renamed files]
```

Structure: artist-named subfolders with renamed files (different from BH submissions).

## OneDrive Detection

AutoHelper has Windows-specific OneDrive integration (`apps/autohelper/autohelper/infra/fs/onedrive.py`):
- Detects offline (cloud-only) files via `FILE_ATTRIBUTE_OFFLINE`
- Can pin files to device or mark as cloud-only (dehydrate)
- File watchers skip cloud-only files
- Setting: `onedrive_detection: true` (Windows only)

## Sync Patterns

### Files → ClickUp (current)
1. AutoHelper scans OneDrive directories via `image_allowed_roots`
2. Records reference images by relative path
3. Autohelper serves images via `/api/image?path=` proxy
4. Task attachments in ClickUp can be uploaded programmatically:

```typescript
import { readFileSync } from 'fs';
const cu = new ClickUp({ token });
const file = readFileSync('E:/OneDrive - .../submission.jpg');
await cu.attachments.upload(taskId, file, 'submission.jpg');
```

### ClickUp → Files (planned)
1. Task status changes in ClickUp trigger webhook events
2. AutoHelper receives webhook, updates local state
3. File operations (move, rename, organize) based on task metadata

## Avoiding Drift

### Principles
1. **ClickUp is authoritative for PM data** — task names, statuses, custom fields, assignments
2. **OneDrive is authoritative for files** — file existence, paths, contents
3. **AutoHelper resolves conflicts** — reads both, reports discrepancies
4. **Template sync catches structural drift** — ensures task list matches template
5. **Scheduled sync** — periodic reconciliation (configurable, default 6h)

### Common Drift Scenarios

| Scenario | Detection | Resolution |
|----------|-----------|------------|
| Task renamed in ClickUp | Template sync reports orphan + create | Manual — decide which name is correct |
| File moved in OneDrive | Image proxy returns 404 | Update `image_allowed_roots` or file path |
| New template task added | Template sync reports create | `force=true` to create in ClickUp |
| Phase field wrong | Template sync reports update | `force=true` to fix, or manual in ClickUp |
| Stale attachment URL | Task shows broken link | Re-upload via `cu.attachments.upload()` |

## Settings Reference

| Setting | Purpose |
|---------|---------|
| `image_allowed_roots` | Directories the image proxy can serve |
| `onedrive_detection` | Enable cloud-only file detection (Windows) |
| `clickup_sync_enabled` | Enable scheduled template sync |
| `clickup_sync_interval_hours` | Sync frequency |
| `artist_storage_root` | Root for artist folder scanning |
