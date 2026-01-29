# Finance Export Integration: Word Templates + OAuth Portal

**Status**: Specification for AutoHelper OAuth integration
**Epic**: Phase 4 of Finance Management System (#173)
**Related**: Invoice PDF formatter (Phase 3c), AutoHelper filesystem integration

---

## Overview

Extend the current PDF-only invoice export to support **Word document templates** that can be routed through AutoHelper's OAuth portal to OneDrive or Google Drive.

**Current State** (Phase 3c):
- ✅ Invoice PDF generation via `invoice-pdf-formatter.ts`
- ✅ HTML templates with Source Serif 4 aesthetic
- ✅ Route: `GET /finance/invoice-pdf/:invoiceId`
- ✅ Returns PDF buffer for browser download

**Target State** (Phase 4):
- ✅ Invoice PDF (existing)
- 🆕 Invoice DOCX (Word template)
- 🆕 OAuth routing to OneDrive/Google Drive
- 🆕 AutoHelper file assignment and tracking

---

## Architecture

### Data Flow

```
AutoArt Frontend
    ↓ (1) User clicks "Export to Word"
    ↓
AutoArt Backend /finance/invoice-docx/:invoiceId
    ↓ (2) Project invoice data
    ↓ (3) Render Word template
    ↓
DOCX Buffer
    ↓ (4) POST to AutoHelper /exports/assign
    ↓
AutoHelper (Local Filesystem)
    ↓ (5) Save to allowed root path
    ↓ (6) Register reference in SQLite
    ↓
OAuth Portal (future)
    ↓ (7) User triggers cloud sync
    ↓
OneDrive / Google Drive
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **AutoArt Backend** | Invoice projection, DOCX generation, buffer creation |
| **AutoHelper** | Filesystem write, reference tracking, file indexing |
| **OAuth Portal** (future) | OneDrive/Google Drive authentication and upload |
| **Frontend** | Export UI, destination selection, progress feedback |

---

## Implementation Plan

### Phase 4a: DOCX Template Generation

**Location**: `shared/src/formatters/invoice-docx-formatter.ts`

**Dependencies**:
- `docx` npm package (official Open XML SDK)
- Existing `invoice.projector.ts` for data

**Template Structure**:

```typescript
import { Document, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, BorderStyle } from 'docx';
import type { InvoiceProjection } from '../projectors/invoice.projector';

export function renderInvoiceDocx(invoice: InvoiceProjection): Document {
  return new Document({
    sections: [
      {
        properties: {},
        children: [
          // Header: Business name, logo placeholder
          new Paragraph({
            text: 'INVOICE',
            heading: 'Heading1',
            alignment: AlignmentType.RIGHT,
          }),
          
          // Invoice metadata table
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Invoice Number:')] }),
                  new TableCell({ children: [new Paragraph(invoice.invoice_number)] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Issue Date:')] }),
                  new TableCell({ children: [new Paragraph(invoice.issue_date)] }),
                ],
              }),
              // ... due_date, client info
            ],
          }),
          
          // Line items table
          new Table({
            rows: [
              // Header row
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Description')] }),
                  new TableCell({ children: [new Paragraph('Qty')] }),
                  new TableCell({ children: [new Paragraph('Unit Price')] }),
                  new TableCell({ children: [new Paragraph('Total')] }),
                ],
              }),
              // Data rows
              ...invoice.lineItems.map(item => 
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(item.description)] }),
                    new TableCell({ children: [new Paragraph(String(item.qty))] }),
                    new TableCell({ children: [new Paragraph(formatCurrency(item.unit_price))] }),
                    new TableCell({ children: [new Paragraph(formatCurrency(item.line_total))] }),
                  ],
                })
              ),
            ],
          }),
          
          // Totals section
          new Paragraph({
            children: [
              new TextRun({ text: 'Subtotal: ', bold: true }),
              new TextRun(formatCurrency(invoice.subtotal)),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Tax: ', bold: true }),
              new TextRun(formatCurrency(invoice.tax_total)),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'TOTAL: ', bold: true, size: 28 }),
              new TextRun({ text: formatCurrency(invoice.total), bold: true, size: 28 }),
            ],
          }),
          
          // Payment history (if any)
          ...(invoice.payments.length > 0 ? [
            new Paragraph({ text: 'Payment History', heading: 'Heading2' }),
            new Table({
              rows: invoice.payments.map(payment => 
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(payment.payment_date)] }),
                    new TableCell({ children: [new Paragraph(payment.method)] }),
                    new TableCell({ children: [new Paragraph(formatCurrency(payment.amount))] }),
                  ],
                })
              ),
            }),
          ] : []),
        ],
      },
    ],
  });
}
```

**Styling Requirements**:
- Font: Source Serif 4 (or fallback to Georgia/Times New Roman)
- Brand color accents (configurable)
- Professional table borders
- Responsive layout (A4/Letter paper sizes)

**Export Route**:

```typescript
// backend/src/modules/exports/exports.routes.ts

fastify.get('/finance/invoice-docx/:invoiceId', async (request, reply) => {
  const { invoiceId } = request.params;
  
  // 1. Project invoice data
  const invoiceData = await projectInvoice(fastify.db, Number(invoiceId));
  
  // 2. Render DOCX
  const doc = renderInvoiceDocx(invoiceData);
  const buffer = await Packer.toBuffer(doc);
  
  // 3. Set headers
  reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  reply.header('Content-Disposition', `attachment; filename="Invoice-${invoiceData.invoice_number}.docx"`);
  
  return buffer;
});
```

---

### Phase 4b: AutoHelper File Assignment

**New AutoHelper Module**: `modules/exports/`

**Endpoint**: `POST /exports/assign`

**Purpose**: Receive exported file from AutoArt, save to allowed root, register reference

**Request Schema**:

```json
{
  "file_name": "Invoice-2026-001.docx",
  "file_data": "<base64-encoded-buffer>",
  "context_type": "project",
  "context_id": 42,
  "work_item_id": "invoice_123",
  "metadata": {
    "export_type": "invoice_docx",
    "invoice_id": 123,
    "invoice_number": "2026-001"
  }
}
```

**AutoHelper Implementation**:

```python
# autohelper/modules/exports/routes.py

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
import base64
from pathlib import Path
from datetime import datetime

router = APIRouter(prefix="/exports")

class AssignFileRequest(BaseModel):
    file_name: str
    file_data: str  # base64
    context_type: str
    context_id: int
    work_item_id: str
    metadata: dict

@router.post("/assign")
async def assign_export(
    req: AssignFileRequest,
    x_request_id: str = Header(None),
    x_idempotency_key: str = Header(None),
):
    """
    Save exported file from AutoArt to filesystem and register reference.
    
    Workflow:
    1. Decode base64 file data
    2. Determine destination path (allowed root + context structure)
    3. Write file atomically
    4. Register reference in SQLite
    5. Return file path + reference ID
    """
    
    # 1. Decode file data
    try:
        file_bytes = base64.b64decode(req.file_data)
    except Exception as e:
        raise HTTPException(400, f"Invalid base64 file_data: {e}")
    
    # 2. Determine path
    # Example: ALLOWED_ROOT/exports/{context_type}/{context_id}/{file_name}
    root_path = Path(config.ALLOWED_ROOTS[0])  # Use first allowed root
    export_dir = root_path / "exports" / req.context_type / str(req.context_id)
    export_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = export_dir / req.file_name
    
    # Path safety check
    if not fs_safety.is_path_allowed(file_path):
        raise HTTPException(403, "Path not allowed")
    
    # 3. Write file atomically
    temp_path = file_path.with_suffix(".tmp")
    try:
        temp_path.write_bytes(file_bytes)
        temp_path.rename(file_path)
    except Exception as e:
        temp_path.unlink(missing_ok=True)
        raise HTTPException(500, f"Failed to write file: {e}")
    
    # 4. Register reference
    reference_id = await db.execute(
        """
        INSERT INTO file_references 
        (file_path, context_type, context_id, work_item_id, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            str(file_path),
            req.context_type,
            req.context_id,
            req.work_item_id,
            json.dumps(req.metadata),
            datetime.utcnow().isoformat(),
        )
    )
    
    # 5. Audit log
    await audit.log({
        "action": "file_assigned",
        "file_path": str(file_path),
        "reference_id": reference_id,
        "work_item_id": req.work_item_id,
        "request_id": x_request_id,
        "idempotency_key": x_idempotency_key,
    })
    
    return {
        "reference_id": reference_id,
        "file_path": str(file_path),
        "file_url": f"file:///{file_path}",  # For local opening
    }
```

**Schema Migration** (AutoHelper):

```sql
-- migrations/004_file_references.sql

CREATE TABLE IF NOT EXISTS file_references (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    context_type TEXT NOT NULL,  -- e.g., 'project', 'process'
    context_id INTEGER NOT NULL,
    work_item_id TEXT,           -- AutoArt work item opaque ID
    metadata TEXT,               -- JSON blob for export metadata
    created_at TEXT NOT NULL,
    synced_to_cloud BOOLEAN DEFAULT 0,
    cloud_url TEXT,              -- OneDrive/Google Drive URL after sync
    UNIQUE(file_path, work_item_id)
);

CREATE INDEX idx_file_references_context ON file_references(context_type, context_id);
CREATE INDEX idx_file_references_work_item ON file_references(work_item_id);
```

---

### Phase 4c: AutoArt → AutoHelper Integration

**Frontend Export Flow**:

```tsx
// frontend/src/ui/workspace/content/finance/InvoiceDetailView.tsx

import { useExportInvoice } from '@/api/hooks/exports';

function InvoiceDetailView({ invoiceId }: { invoiceId: number }) {
  const exportInvoice = useExportInvoice();
  
  const handleExportWord = async () => {
    try {
      // 1. Request DOCX from backend
      const response = await fetch(`/api/finance/invoice-docx/${invoiceId}`);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      // 2. Assign to AutoHelper
      const result = await exportInvoice.mutateAsync({
        file_name: `Invoice-${invoice.invoice_number}.docx`,
        file_data: base64,
        context_type: 'project',
        context_id: invoice.project_id,
        work_item_id: `invoice_${invoiceId}`,
        metadata: {
          export_type: 'invoice_docx',
          invoice_id: invoiceId,
          invoice_number: invoice.invoice_number,
        },
      });
      
      // 3. Show success + options
      toast.success('Invoice exported to Word');
      
      // Option A: Open locally
      window.open(result.file_url, '_blank');
      
      // Option B: Show sync dialog (future)
      // openCloudSyncDialog(result.reference_id);
      
    } catch (error) {
      toast.error('Export failed');
    }
  };
  
  return (
    <div>
      {/* ... invoice details ... */}
      
      <div className="export-actions">
        <Button onClick={() => window.open(`/api/finance/invoice-pdf/${invoiceId}`)}>
          📄 Download PDF
        </Button>
        <Button onClick={handleExportWord}>
          📝 Export to Word
        </Button>
      </div>
    </div>
  );
}
```

**API Hook**:

```typescript
// frontend/src/api/hooks/exports.ts

import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';

const AssignFileSchema = z.object({
  file_name: z.string(),
  file_data: z.string(),  // base64
  context_type: z.string(),
  context_id: z.number(),
  work_item_id: z.string(),
  metadata: z.record(z.unknown()),
});

export function useExportInvoice() {
  return useMutation({
    mutationFn: async (data: z.infer<typeof AssignFileSchema>) => {
      // Call AutoHelper directly (via configured URL)
      const autohelperUrl = import.meta.env.VITE_AUTOHELPER_URL || 'http://localhost:8100';
      
      const response = await fetch(`${autohelperUrl}/exports/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': crypto.randomUUID(),
          'X-Idempotency-Key': `export_${data.work_item_id}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`AutoHelper export failed: ${response.statusText}`);
      }
      
      return response.json();
    },
  });
}
```

---

### Phase 4d: OAuth Portal (Future Spec)

**Deferred to Phase 5**: Cloud sync UI and OAuth implementation

**Requirements**:

1. **OAuth Providers**:
   - Microsoft OneDrive (Microsoft Graph API)
   - Google Drive (Google Drive API)

2. **AutoHelper OAuth Module** (`modules/oauth/`):
   - `GET /oauth/authorize/:provider` - Redirect to provider consent screen
   - `GET /oauth/callback/:provider` - Handle OAuth callback, store tokens
   - `POST /oauth/sync/:referenceId` - Upload file to cloud provider

3. **Token Storage**:
   - SQLite table `oauth_tokens` with encrypted access/refresh tokens
   - Per-user token management (if multi-user)

4. **Sync Flow**:
   ```
   User clicks "Sync to OneDrive"
       ↓
   Check oauth_tokens for valid OneDrive token
       ↓ (if missing/expired)
   Redirect to /oauth/authorize/onedrive
       ↓
   User consents → callback → store token
       ↓
   POST /oauth/sync/:referenceId
       ↓
   AutoHelper uploads file to OneDrive
       ↓
   Update file_references.synced_to_cloud = 1, cloud_url = <onedrive_url>
       ↓
   Frontend shows "Open in OneDrive" link
   ```

5. **Security**:
   - Tokens encrypted at rest (using `cryptography` library)
   - Token refresh handled automatically
   - Scoped permissions (Files.ReadWrite.All for OneDrive)

**Postponed Rationale**: Export-to-local is sufficient for MVP. OAuth adds significant complexity and requires careful security review.

---

## Configuration

### Environment Variables

**AutoArt** (`.env`):
```bash
# No changes needed - uses existing AutoHelper connection
```

**AutoHelper** (`.env`):
```bash
# Existing
AUTOHELPER_ALLOWED_ROOTS="C:\\Projects,D:\\Exports"
AUTOHELPER_DB_PATH="./data/autohelper.db"

# New for OAuth (Phase 5)
# AUTOHELPER_ONEDRIVE_CLIENT_ID="<client-id>"
# AUTOHELPER_ONEDRIVE_CLIENT_SECRET="<client-secret>"
# AUTOHELPER_GOOGLE_CLIENT_ID="<client-id>"
# AUTOHELPER_GOOGLE_CLIENT_SECRET="<client-secret>"
```

**Frontend** (`.env`):
```bash
VITE_AUTOHELPER_URL="http://localhost:8100"
```

---

## Testing Strategy

### Unit Tests

**AutoArt**:
- `invoice-docx-formatter.test.ts` - Template rendering with sample data
- Verify table structure, styling, currency formatting

**AutoHelper**:
- `test_exports_assign.py` - File write, path safety, reference creation
- `test_exports_idempotency.py` - Same file assigned twice with same key

### Integration Tests

**End-to-End**:
1. Create invoice in AutoArt
2. Add line items, client
3. Export to Word
4. Verify AutoHelper saved file to allowed root
5. Verify `file_references` entry created
6. Open file locally and inspect content

**OAuth Flow** (Phase 5):
1. Export invoice
2. Click "Sync to OneDrive"
3. Complete OAuth consent (test with real OneDrive account)
4. Verify file appears in OneDrive
5. Verify `cloud_url` populated in `file_references`

---

## Rollout Plan

### Phase 4a (Week 1)
- ✅ Implement `invoice-docx-formatter.ts`
- ✅ Add `/finance/invoice-docx/:invoiceId` route
- ✅ Unit tests for DOCX generation
- ✅ Manual testing: Download DOCX, open in Word/LibreOffice

### Phase 4b (Week 1)
- ✅ AutoHelper: Add `file_references` table migration
- ✅ AutoHelper: Implement `POST /exports/assign` endpoint
- ✅ Unit tests for file assignment

### Phase 4c (Week 2)
- ✅ Frontend: Add "Export to Word" button
- ✅ Frontend: Implement `useExportInvoice` hook
- ✅ Integration: Wire up AutoArt → AutoHelper flow
- ✅ E2E test: Full export flow

### Phase 4d (Deferred)
- ⏸️ OAuth portal implementation
- ⏸️ OneDrive/Google Drive sync UI

---

## Success Metrics

**Phase 4a-c** (MVP):
- ✅ Users can export invoices to Word format
- ✅ Files saved to configured local filesystem
- ✅ Files tracked in AutoHelper references
- ✅ <2 second export time for typical invoice

**Phase 4d** (Future):
- 📊 >80% of users enable cloud sync
- 📊 <5 second OneDrive/Google Drive upload time
- 📊 Zero token leakage incidents

---

## Open Questions

1. **Template Customization**: Should users be able to customize Word templates?
   - **Answer**: Phase 5 - allow template upload to replace default

2. **Multi-Currency**: How to handle invoices in different currencies?
   - **Answer**: DOCX formatter reads `currency` field from invoice, formats accordingly

3. **Batch Export**: Export multiple invoices at once?
   - **Answer**: Phase 5 - ZIP archive of multiple DOCX files

4. **AutoHelper Multi-User**: How to isolate files per AutoArt user?
   - **Answer**: Current design uses `context_id` (project-level). User isolation is Phase 6.

---

## Related Documentation

- [Finance Management Epic #173](https://github.com/ok-very/autoart/issues/173)
- [AutoHelper README](https://github.com/ok-very/AutoHelper/blob/main/README.md)
- [Invoice PDF Formatter](../shared/src/formatters/invoice-pdf-formatter.ts)
- [Export Routes](../backend/src/modules/exports/exports.routes.ts)

---

**Last Updated**: 2026-01-29  
**Authors**: AutoArt Team  
**Status**: Phase 4a-c ready for implementation, Phase 4d deferred
