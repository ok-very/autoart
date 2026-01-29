# Finance Export Integration: Word Templates + Cloud Storage

**Status**: Specification for OAuth-enabled cloud document export
**Epic**: Phase 4 of Finance Management System (#173)
**Related**: Invoice PDF formatter (Phase 3c), AutoHelper local filesystem

---

## Overview

Extend the current PDF-only invoice export to support **Word document templates** that can be **directly uploaded to OneDrive or Google Drive** via OAuth-authenticated APIs. AutoHelper is only used as a fallback for local filesystem writes if cloud storage is unavailable.

**Current State** (Phase 3c):
- ✅ Invoice PDF generation via `invoice-pdf-formatter.ts`
- ✅ HTML templates with Source Serif 4 aesthetic
- ✅ Route: `GET /finance/invoice-pdf/:invoiceId`
- ✅ Returns PDF buffer for browser download

**Target State** (Phase 4):
- ✅ Invoice PDF (existing)
- 🆕 Invoice DOCX (Word template)
- 🆕 Direct upload to OneDrive via Microsoft Graph API
- 🆕 Direct upload to Google Drive via Google Drive API
- 🆕 OAuth token management in AutoArt
- 🆕 AutoHelper fallback for local-only exports

---

## Architecture

### Primary Flow: Direct Cloud API Integration

```
AutoArt Frontend
    ↓ (1) User clicks "Export to OneDrive"
    ↓
AutoArt Backend /finance/invoice-docx/:invoiceId/export
    ↓ (2) Check OAuth tokens for OneDrive
    ↓ (3) Project invoice data
    ↓ (4) Render DOCX template
    ↓
DOCX Buffer
    ↓ (5) Upload directly to OneDrive via Microsoft Graph API
    ↓
OneDrive
    ↓ (6) Return sharing link
    ↓
AutoArt Frontend
    ↓ (7) Show "Open in OneDrive" link
```

### Fallback Flow: Local Filesystem via AutoHelper

```
AutoArt Frontend
    ↓ (1) User clicks "Export to Local"
    ↓
AutoArt Backend /finance/invoice-docx/:invoiceId/download
    ↓ (2) Generate DOCX
    ↓
DOCX Buffer
    ↓ (3) Either:
         a) Return as download to browser (default)
         b) POST to AutoHelper /files/write (if local persistence needed)
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **AutoArt Backend** | Invoice projection, DOCX generation, OAuth management, cloud API calls |
| **Microsoft Graph API** | OneDrive file upload, sharing link generation |
| **Google Drive API** | Google Drive file upload, sharing link generation |
| **AutoHelper** | Local filesystem writes ONLY (fallback, not primary) |
| **Frontend** | Export UI, OAuth consent flow initiation, destination selection |

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
        properties: {
          page: {
            margin: {
              top: 720,    // 0.5 inch
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: [
          // Header: Business name, logo placeholder
          new Paragraph({
            text: 'INVOICE',
            heading: 'Heading1',
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 },
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
                  new TableCell({ children: [new Paragraph(formatDate(invoice.issue_date))] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Due Date:')] }),
                  new TableCell({ children: [new Paragraph(formatDate(invoice.due_date))] }),
                ],
              }),
            ],
            width: { size: 100, type: 'pct' },
          }),
          
          new Paragraph({ text: '' }), // Spacer
          
          // Client info
          new Paragraph({
            text: 'Bill To:',
            bold: true,
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({ text: invoice.client?.name || 'N/A' }),
          ...(invoice.client?.email ? [new Paragraph({ text: invoice.client.email })] : []),
          
          new Paragraph({ text: '' }), // Spacer
          
          // Line items table
          new Table({
            rows: [
              // Header row
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: 'Description', bold: true })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Qty', bold: true })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Unit Price', bold: true })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Total', bold: true })] }),
                ],
              }),
              // Data rows
              ...invoice.lineItems.map(item => 
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(item.description)] }),
                    new TableCell({ children: [new Paragraph(String(item.qty))] }),
                    new TableCell({ children: [new Paragraph(formatCurrency(item.unit_price, invoice.currency))] }),
                    new TableCell({ children: [new Paragraph(formatCurrency(item.line_total, invoice.currency))] }),
                  ],
                })
              ),
            ],
            width: { size: 100, type: 'pct' },
          }),
          
          new Paragraph({ text: '' }), // Spacer
          
          // Totals section (right-aligned)
          new Paragraph({
            children: [
              new TextRun({ text: 'Subtotal: ', bold: true }),
              new TextRun(formatCurrency(invoice.subtotal, invoice.currency)),
            ],
            alignment: AlignmentType.RIGHT,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Tax: ', bold: true }),
              new TextRun(formatCurrency(invoice.tax_total, invoice.currency)),
            ],
            alignment: AlignmentType.RIGHT,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'TOTAL: ', bold: true, size: 28 }),
              new TextRun({ text: formatCurrency(invoice.total, invoice.currency), bold: true, size: 28 }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { before: 200 },
          }),
          
          // Payment history (if any)
          ...(invoice.payments.length > 0 ? [
            new Paragraph({ text: '', spacing: { before: 400 } }),
            new Paragraph({ text: 'Payment History', heading: 'Heading2' }),
            new Table({
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: 'Date', bold: true })] }),
                    new TableCell({ children: [new Paragraph({ text: 'Method', bold: true })] }),
                    new TableCell({ children: [new Paragraph({ text: 'Amount', bold: true })] }),
                  ],
                }),
                ...invoice.payments.map(payment => 
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph(formatDate(payment.payment_date))] }),
                      new TableCell({ children: [new Paragraph(payment.method)] }),
                      new TableCell({ children: [new Paragraph(formatCurrency(payment.amount, invoice.currency))] }),
                    ],
                  })
                ),
              ],
            }),
          ] : []),
        ],
      },
    ],
  });
}

function formatCurrency(cents: number, currency: string): string {
  const amount = cents / 100;
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency || 'CAD',
  }).format(amount);
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
```

**Styling Requirements**:
- Font: Source Serif 4 (or fallback to Georgia/Times New Roman)
- Professional table borders
- A4/Letter paper size compatible
- Brand color accents (configurable via document properties)

---

### Phase 4b: OAuth Token Management

**Location**: `backend/src/modules/integrations/` (new module)

**Database Schema**:

```sql
-- backend/src/db/migrations/XXX_oauth_tokens.sql

CREATE TABLE oauth_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,  -- 'onedrive' | 'google_drive'
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_oauth_tokens_user_provider ON oauth_tokens(user_id, provider);
CREATE INDEX idx_oauth_tokens_expires ON oauth_tokens(expires_at);
```

**OAuth Service**:

```typescript
// backend/src/modules/integrations/oauth.service.ts

import type { Kysely } from 'kysely';
import type { Database } from '../../db/schema';
import { encrypt, decrypt } from '../../utils/crypto';  // Use existing crypto utils

export class OAuthService {
  constructor(private db: Kysely<Database>) {}

  async getToken(userId: number, provider: 'onedrive' | 'google_drive') {
    const row = await this.db
      .selectFrom('oauth_tokens')
      .selectAll()
      .where('user_id', '=', userId)
      .where('provider', '=', provider)
      .executeTakeFirst();

    if (!row) return null;

    // Check if expired
    if (new Date(row.expires_at) < new Date()) {
      // Attempt refresh
      return this.refreshToken(userId, provider, row.refresh_token);
    }

    return {
      accessToken: decrypt(row.access_token),
      refreshToken: decrypt(row.refresh_token),
      expiresAt: row.expires_at,
    };
  }

  async saveToken(
    userId: number,
    provider: 'onedrive' | 'google_drive',
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number; // seconds
    }
  ) {
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    await this.db
      .insertInto('oauth_tokens')
      .values({
        user_id: userId,
        provider,
        access_token: encrypt(tokens.accessToken),
        refresh_token: encrypt(tokens.refreshToken),
        expires_at: expiresAt,
      })
      .onConflict((oc) =>
        oc.columns(['user_id', 'provider']).doUpdateSet({
          access_token: encrypt(tokens.accessToken),
          refresh_token: encrypt(tokens.refreshToken),
          expires_at: expiresAt,
          updated_at: new Date(),
        })
      )
      .execute();
  }

  private async refreshToken(
    userId: number,
    provider: 'onedrive' | 'google_drive',
    encryptedRefreshToken: string
  ) {
    const refreshToken = decrypt(encryptedRefreshToken);

    if (provider === 'onedrive') {
      // Microsoft Graph token refresh
      const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.ONEDRIVE_CLIENT_ID!,
          client_secret: process.env.ONEDRIVE_CLIENT_SECRET!,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh OneDrive token');
      }

      const data = await response.json();
      await this.saveToken(userId, provider, {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Some providers don't return new refresh token
        expiresIn: data.expires_in,
      });

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };
    }

    // TODO: Google Drive refresh logic
    throw new Error('Google Drive refresh not implemented');
  }
}
```

**OAuth Routes**:

```typescript
// backend/src/modules/integrations/oauth.routes.ts

import type { FastifyInstance } from 'fastify';
import { OAuthService } from './oauth.service';

export function oauthRoutes(fastify: FastifyInstance) {
  const oauthService = new OAuthService(fastify.db);

  // Initiate OAuth flow
  fastify.get('/oauth/:provider/authorize', async (request, reply) => {
    const { provider } = request.params as { provider: 'onedrive' | 'google_drive' };
    const userId = request.user.id; // Assumes auth middleware

    if (provider === 'onedrive') {
      const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
      authUrl.searchParams.set('client_id', process.env.ONEDRIVE_CLIENT_ID!);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', `${process.env.BACKEND_URL}/api/oauth/onedrive/callback`);
      authUrl.searchParams.set('scope', 'Files.ReadWrite.All offline_access');
      authUrl.searchParams.set('state', Buffer.from(JSON.stringify({ userId })).toString('base64'));

      return reply.redirect(authUrl.toString());
    }

    // TODO: Google Drive authorize URL
    return reply.code(400).send({ error: 'Provider not supported' });
  });

  // OAuth callback handler
  fastify.get('/oauth/:provider/callback', async (request, reply) => {
    const { provider } = request.params as { provider: 'onedrive' | 'google_drive' };
    const { code, state } = request.query as { code: string; state: string };

    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

    if (provider === 'onedrive') {
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.ONEDRIVE_CLIENT_ID!,
          client_secret: process.env.ONEDRIVE_CLIENT_SECRET!,
          code,
          redirect_uri: `${process.env.BACKEND_URL}/api/oauth/onedrive/callback`,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        return reply.code(500).send({ error: 'Failed to exchange code for token' });
      }

      const tokens = await tokenResponse.json();
      await oauthService.saveToken(userId, 'onedrive', {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
      });

      // Redirect to frontend settings page with success message
      return reply.redirect(`${process.env.FRONTEND_URL}/settings?oauth=success&provider=onedrive`);
    }

    return reply.code(400).send({ error: 'Provider not supported' });
  });

  // Check OAuth status
  fastify.get('/oauth/:provider/status', async (request, reply) => {
    const { provider } = request.params as { provider: 'onedrive' | 'google_drive' };
    const userId = request.user.id;

    const token = await oauthService.getToken(userId, provider);

    return {
      connected: !!token,
      expiresAt: token?.expiresAt || null,
    };
  });

  // Disconnect OAuth
  fastify.delete('/oauth/:provider', async (request, reply) => {
    const { provider } = request.params as { provider: 'onedrive' | 'google_drive' };
    const userId = request.user.id;

    await fastify.db
      .deleteFrom('oauth_tokens')
      .where('user_id', '=', userId)
      .where('provider', '=', provider)
      .execute();

    return { success: true };
  });
}
```

---

### Phase 4c: Cloud Upload Service

**OneDrive Upload**:

```typescript
// backend/src/modules/integrations/onedrive.service.ts

import type { OAuthService } from './oauth.service';

export class OneDriveService {
  constructor(private oauthService: OAuthService) {}

  async uploadFile(
    userId: number,
    fileName: string,
    fileBuffer: Buffer,
    folderPath: string = '/AutoArt/Invoices'
  ): Promise<{ webUrl: string; id: string }> {
    // 1. Get valid access token
    const token = await this.oauthService.getToken(userId, 'onedrive');
    if (!token) {
      throw new Error('OneDrive not connected. Please authorize in settings.');
    }

    // 2. Ensure folder exists (create if needed)
    await this.ensureFolderExists(token.accessToken, folderPath);

    // 3. Upload file via Microsoft Graph API
    const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:${folderPath}/${fileName}:/content`;
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      throw new Error(`OneDrive upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      webUrl: data.webUrl,
      id: data.id,
    };
  }

  private async ensureFolderExists(accessToken: string, folderPath: string) {
    // Microsoft Graph API: Check if folder exists, create if not
    const parts = folderPath.split('/').filter(Boolean);
    let currentPath = '';

    for (const part of parts) {
      currentPath += `/${part}`;
      const checkUrl = `https://graph.microsoft.com/v1.0/me/drive/root:${currentPath}`;

      const checkResponse = await fetch(checkUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (checkResponse.status === 404) {
        // Folder doesn't exist, create it
        const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
        const createUrl = `https://graph.microsoft.com/v1.0/me/drive/root:${parentPath}:/children`;

        await fetch(createUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: part,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'rename',
          }),
        });
      }
    }
  }
}
```

**Google Drive Upload** (similar pattern):

```typescript
// backend/src/modules/integrations/google-drive.service.ts

import type { OAuthService } from './oauth.service';

export class GoogleDriveService {
  constructor(private oauthService: OAuthService) {}

  async uploadFile(
    userId: number,
    fileName: string,
    fileBuffer: Buffer,
    folderName: string = 'AutoArt Invoices'
  ): Promise<{ webViewLink: string; id: string }> {
    const token = await this.oauthService.getToken(userId, 'google_drive');
    if (!token) {
      throw new Error('Google Drive not connected. Please authorize in settings.');
    }

    // 1. Find or create folder
    const folderId = await this.findOrCreateFolder(token.accessToken, folderName);

    // 2. Upload file
    const metadata = {
      name: fileName,
      parents: [folderId],
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([fileBuffer]));

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
      },
      body: form,
    });

    if (!response.ok) {
      throw new Error(`Google Drive upload failed: ${response.statusText}`);
    }

    const data = await response.json();

    // 3. Get web view link
    const fileResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}?fields=webViewLink`, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });

    const fileData = await fileResponse.json();

    return {
      webViewLink: fileData.webViewLink,
      id: data.id,
    };
  }

  private async findOrCreateFolder(accessToken: string, folderName: string): Promise<string> {
    // Search for existing folder
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const searchData = await searchResponse.json();

    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // Create folder
    const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    const createData = await createResponse.json();
    return createData.id;
  }
}
```

---

### Phase 4d: Export Routes with Cloud Integration

```typescript
// backend/src/modules/exports/exports.routes.ts

import { Packer } from 'docx';
import { renderInvoiceDocx } from '@autoart/shared/formatters/invoice-docx-formatter';
import { projectInvoice } from './projectors/invoice.projector';
import { OneDriveService } from '../integrations/onedrive.service';
import { GoogleDriveService } from '../integrations/google-drive.service';

// Export to OneDrive
fastify.post('/finance/invoice-docx/:invoiceId/export/onedrive', async (request, reply) => {
  const { invoiceId } = request.params;
  const userId = request.user.id;

  // 1. Project invoice data
  const invoiceData = await projectInvoice(fastify.db, Number(invoiceId));

  // 2. Render DOCX
  const doc = renderInvoiceDocx(invoiceData);
  const buffer = await Packer.toBuffer(doc);

  // 3. Upload to OneDrive
  const onedriveService = new OneDriveService(fastify.oauthService);
  const result = await onedriveService.uploadFile(
    userId,
    `Invoice-${invoiceData.invoice_number}.docx`,
    buffer
  );

  // 4. Emit event
  await fastify.composer.recordEvent({
    actionType: 'invoice.exported',
    contextType: 'project',
    contextId: invoiceData.project_id,
    payload: {
      invoiceId: Number(invoiceId),
      invoiceNumber: invoiceData.invoice_number,
      destination: 'onedrive',
      cloudUrl: result.webUrl,
    },
  });

  return {
    success: true,
    webUrl: result.webUrl,
    cloudId: result.id,
  };
});

// Export to Google Drive
fastify.post('/finance/invoice-docx/:invoiceId/export/google-drive', async (request, reply) => {
  const { invoiceId } = request.params;
  const userId = request.user.id;

  const invoiceData = await projectInvoice(fastify.db, Number(invoiceId));
  const doc = renderInvoiceDocx(invoiceData);
  const buffer = await Packer.toBuffer(doc);

  const googleDriveService = new GoogleDriveService(fastify.oauthService);
  const result = await googleDriveService.uploadFile(
    userId,
    `Invoice-${invoiceData.invoice_number}.docx`,
    buffer
  );

  await fastify.composer.recordEvent({
    actionType: 'invoice.exported',
    contextType: 'project',
    contextId: invoiceData.project_id,
    payload: {
      invoiceId: Number(invoiceId),
      invoiceNumber: invoiceData.invoice_number,
      destination: 'google_drive',
      cloudUrl: result.webViewLink,
    },
  });

  return {
    success: true,
    webUrl: result.webViewLink,
    cloudId: result.id,
  };
});

// Fallback: Download to browser
fastify.get('/finance/invoice-docx/:invoiceId/download', async (request, reply) => {
  const { invoiceId } = request.params;

  const invoiceData = await projectInvoice(fastify.db, Number(invoiceId));
  const doc = renderInvoiceDocx(invoiceData);
  const buffer = await Packer.toBuffer(doc);

  reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  reply.header('Content-Disposition', `attachment; filename="Invoice-${invoiceData.invoice_number}.docx"`);

  return buffer;
});
```

---

### Phase 4e: AutoHelper Fallback (Local Write Only)

**Only used if user specifically wants local filesystem persistence.**

```typescript
// Optional: If user has AutoHelper configured and wants local copy
fastify.post('/finance/invoice-docx/:invoiceId/export/local', async (request, reply) => {
  const { invoiceId } = request.params;
  const autohelperUrl = process.env.AUTOHELPER_URL;

  if (!autohelperUrl) {
    return reply.code(503).send({ error: 'AutoHelper not configured' });
  }

  const invoiceData = await projectInvoice(fastify.db, Number(invoiceId));
  const doc = renderInvoiceDocx(invoiceData);
  const buffer = await Packer.toBuffer(doc);

  // POST to AutoHelper
  const response = await fetch(`${autohelperUrl}/files/write`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Work-Item-ID': `invoice_${invoiceId}`,
      'X-Context-ID': String(invoiceData.project_id),
    },
    body: JSON.stringify({
      file_name: `Invoice-${invoiceData.invoice_number}.docx`,
      file_data: buffer.toString('base64'),
      context_type: 'project',
      context_id: invoiceData.project_id,
      metadata: {
        export_type: 'invoice_docx',
        invoice_id: invoiceId,
      },
    }),
  });

  if (!response.ok) {
    return reply.code(502).send({ error: 'AutoHelper write failed' });
  }

  const result = await response.json();
  return {
    success: true,
    filePath: result.file_path,
  };
});
```

---

### Phase 4f: Frontend Integration

**Export Dialog with Destination Selection**:

```tsx
// frontend/src/ui/workspace/content/finance/InvoiceDetailView.tsx

import { useState } from 'react';
import { useExportInvoice, useOAuthStatus } from '@/api/hooks/exports';
import { Button } from '@autoart/ui';

function InvoiceDetailView({ invoice }: { invoice: Invoice }) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportInvoice = useExportInvoice();
  const { data: onedriveStatus } = useOAuthStatus('onedrive');
  const { data: googleDriveStatus } = useOAuthStatus('google_drive');

  const handleExport = async (destination: 'onedrive' | 'google_drive' | 'download') => {
    if (destination === 'onedrive' && !onedriveStatus?.connected) {
      // Redirect to OAuth authorization
      window.location.href = `/api/oauth/onedrive/authorize`;
      return;
    }

    if (destination === 'google_drive' && !googleDriveStatus?.connected) {
      window.location.href = `/api/oauth/google-drive/authorize`;
      return;
    }

    try {
      const result = await exportInvoice.mutateAsync({
        invoiceId: invoice.id,
        destination,
      });

      if (destination === 'download') {
        // Browser download
        window.location.href = `/api/finance/invoice-docx/${invoice.id}/download`;
      } else {
        // Cloud export
        toast.success(`Invoice exported to ${destination === 'onedrive' ? 'OneDrive' : 'Google Drive'}`);
        window.open(result.webUrl, '_blank');
      }
    } catch (error) {
      toast.error('Export failed');
    }
  };

  return (
    <div>
      {/* ... invoice details ... */}

      <div className="export-actions">
        <Button onClick={() => window.open(`/api/finance/invoice-pdf/${invoice.id}`)}>
          📄 Download PDF
        </Button>

        <div className="relative">
          <Button onClick={() => setShowExportMenu(!showExportMenu)}>
            📝 Export to Word ▾
          </Button>

          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white shadow-lg rounded border">
              <button
                onClick={() => handleExport('onedrive')}
                className="w-full px-4 py-2 text-left hover:bg-gray-100"
              >
                📁 Export to OneDrive
                {!onedriveStatus?.connected && (
                  <span className="text-xs text-gray-500"> (Connect first)</span>
                )}
              </button>
              <button
                onClick={() => handleExport('google_drive')}
                className="w-full px-4 py-2 text-left hover:bg-gray-100"
              >
                📁 Export to Google Drive
                {!googleDriveStatus?.connected && (
                  <span className="text-xs text-gray-500"> (Connect first)</span>
                )}
              </button>
              <hr />
              <button
                onClick={() => handleExport('download')}
                className="w-full px-4 py-2 text-left hover:bg-gray-100"
              >
                💾 Download to Computer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**API Hooks**:

```typescript
// frontend/src/api/hooks/exports.ts

import { useMutation, useQuery } from '@tanstack/react-query';

export function useOAuthStatus(provider: 'onedrive' | 'google_drive') {
  return useQuery({
    queryKey: ['oauth', provider],
    queryFn: async () => {
      const response = await fetch(`/api/oauth/${provider}/status`);
      if (!response.ok) throw new Error('Failed to check OAuth status');
      return response.json() as Promise<{ connected: boolean; expiresAt: string | null }>;
    },
  });
}

export function useExportInvoice() {
  return useMutation({
    mutationFn: async ({
      invoiceId,
      destination,
    }: {
      invoiceId: number;
      destination: 'onedrive' | 'google_drive' | 'download';
    }) => {
      if (destination === 'download') {
        // Handled by browser, no API call needed
        return { success: true };
      }

      const response = await fetch(
        `/api/finance/invoice-docx/${invoiceId}/export/${destination}`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error(`Export to ${destination} failed`);
      }

      return response.json() as Promise<{ success: boolean; webUrl: string; cloudId: string }>;
    },
  });
}
```

**Settings Page OAuth Management**:

```tsx
// frontend/src/pages/settings/IntegrationsSection.tsx

import { useOAuthStatus } from '@/api/hooks/exports';
import { Button } from '@autoart/ui';

export function IntegrationsSection() {
  const { data: onedriveStatus, refetch: refetchOneDrive } = useOAuthStatus('onedrive');
  const { data: googleDriveStatus, refetch: refetchGoogleDrive } = useOAuthStatus('google_drive');

  const handleConnect = (provider: string) => {
    window.location.href = `/api/oauth/${provider}/authorize`;
  };

  const handleDisconnect = async (provider: string) => {
    await fetch(`/api/oauth/${provider}`, { method: 'DELETE' });
    if (provider === 'onedrive') refetchOneDrive();
    if (provider === 'google_drive') refetchGoogleDrive();
  };

  return (
    <div>
      <h2>Cloud Storage</h2>
      <p className="text-sm text-gray-600">
        Connect cloud storage to export invoices directly to OneDrive or Google Drive.
      </p>

      <div className="mt-4 space-y-4">
        <div className="flex items-center justify-between p-4 border rounded">
          <div>
            <h3 className="font-semibold">OneDrive</h3>
            <p className="text-sm text-gray-600">
              {onedriveStatus?.connected ? '✅ Connected' : '⚠️ Not connected'}
            </p>
          </div>
          {onedriveStatus?.connected ? (
            <Button variant="outline" onClick={() => handleDisconnect('onedrive')}>
              Disconnect
            </Button>
          ) : (
            <Button onClick={() => handleConnect('onedrive')}>Connect</Button>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border rounded">
          <div>
            <h3 className="font-semibold">Google Drive</h3>
            <p className="text-sm text-gray-600">
              {googleDriveStatus?.connected ? '✅ Connected' : '⚠️ Not connected'}
            </p>
          </div>
          {googleDriveStatus?.connected ? (
            <Button variant="outline" onClick={() => handleDisconnect('google_drive')}>
              Disconnect
            </Button>
          ) : (
            <Button onClick={() => handleConnect('google_drive')}>Connect</Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Configuration

### Environment Variables

**AutoArt Backend** (`.env`):
```bash
# OAuth Providers
ONEDRIVE_CLIENT_ID="<microsoft-app-client-id>"
ONEDRIVE_CLIENT_SECRET="<microsoft-app-client-secret>"
GOOGLE_DRIVE_CLIENT_ID="<google-oauth-client-id>"
GOOGLE_DRIVE_CLIENT_SECRET="<google-oauth-client-secret>"

# URLs
BACKEND_URL="https://api.autoart.example.com"
FRONTEND_URL="https://app.autoart.example.com"

# Optional: AutoHelper for local writes
AUTOHELPER_URL="http://localhost:8100"
```

**AutoHelper** (`.env`):
```bash
# No OAuth needed - AutoHelper only handles local filesystem
AUTOHELPER_ALLOWED_ROOTS="C:\\Projects,D:\\Exports"
AUTOHELPER_DB_PATH="./data/autohelper.db"
```

---

## OAuth App Registration

### Microsoft OneDrive

1. Go to [Azure Portal](https://portal.azure.com/) → App Registrations
2. New Registration:
   - Name: "AutoArt Finance Export"
   - Supported account types: Multitenant
   - Redirect URI: `https://api.autoart.example.com/api/oauth/onedrive/callback`
3. API Permissions:
   - Add `Files.ReadWrite.All` (delegated)
   - Add `offline_access` (delegated)
4. Certificates & Secrets:
   - New client secret → Save to `ONEDRIVE_CLIENT_SECRET`
5. Copy Application (client) ID → Save to `ONEDRIVE_CLIENT_ID`

### Google Drive

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create Project → Enable Google Drive API
3. Credentials → Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Authorized redirect URIs: `https://api.autoart.example.com/api/oauth/google-drive/callback`
4. Download JSON → Extract `client_id` and `client_secret`
5. OAuth Consent Screen:
   - Scopes: `https://www.googleapis.com/auth/drive.file`

---

## Testing Strategy

### Unit Tests

**DOCX Formatter**:
- `invoice-docx-formatter.test.ts` - Template rendering
- Verify table structure, totals, payment history

**OAuth Service**:
- `oauth.service.test.ts` - Token encryption/decryption
- Token refresh logic
- Expiration handling

**Cloud Upload Services**:
- Mock Microsoft Graph API responses
- Mock Google Drive API responses
- Error handling (401, 403, 500)

### Integration Tests

**End-to-End OAuth Flow**:
1. User initiates OneDrive connection
2. Redirected to Microsoft consent page
3. Callback processes code exchange
4. Token saved encrypted to database
5. Settings page shows "Connected"

**End-to-End Export Flow**:
1. Create invoice in AutoArt
2. Click "Export to OneDrive"
3. DOCX generated and uploaded
4. Verify file appears in OneDrive /AutoArt/Invoices folder
5. Verify `invoice.exported` event recorded
6. Verify sharing link opens in browser

---

## Security Considerations

1. **Token Encryption**: All OAuth tokens encrypted at rest using AES-256
2. **HTTPS Only**: OAuth callbacks require HTTPS in production
3. **CSRF Protection**: State parameter validates OAuth callback origin
4. **Token Rotation**: Refresh tokens automatically when expired
5. **Scoped Permissions**: Minimum required permissions (Files.ReadWrite vs Files.ReadWrite.All)
6. **User Isolation**: Tokens stored per-user, never shared across accounts

---

## Success Metrics

- ✅ Users can export invoices to Word format
- ✅ Direct upload to OneDrive/Google Drive without manual steps
- ✅ <3 second end-to-end export time (generation + upload)
- ✅ >90% OAuth connection success rate
- ✅ Zero token leakage incidents
- ✅ AutoHelper optional (not required for cloud exports)

---

## Rollout Plan

### Week 1: DOCX Generation
- ✅ Implement `invoice-docx-formatter.ts`
- ✅ Add download route `/finance/invoice-docx/:id/download`
- ✅ Unit tests for template rendering

### Week 2: OAuth Infrastructure
- ✅ Database migration for `oauth_tokens` table
- ✅ Implement `OAuthService` with encryption
- ✅ OAuth routes for authorize/callback/status/disconnect
- ✅ Settings page OAuth management UI

### Week 3: Cloud Uploads
- ✅ `OneDriveService` implementation
- ✅ `GoogleDriveService` implementation
- ✅ Export routes with cloud destination
- ✅ Frontend export dialog with destination picker

### Week 4: Testing & Polish
- ✅ E2E tests for OAuth flows
- ✅ E2E tests for cloud exports
- ✅ Error handling and user feedback
- ✅ Documentation and deployment

---

## AutoHelper Role (Clarified)

**AutoHelper is NOT an OAuth portal.** It serves two purposes:

1. **Local Filesystem Indexing**: Scan and index files in allowed roots for search
2. **Local Write Fallback**: If user wants a local copy saved to their filesystem

**Cloud exports do NOT go through AutoHelper.** They use direct API integration:
- AutoArt Backend → Microsoft Graph API → OneDrive
- AutoArt Backend → Google Drive API → Google Drive

**When to use AutoHelper**:
- User clicks "Save to Local Folder" (optional)
- User wants AutoHelper to index the exported file
- User has specific local filesystem requirements

**When NOT to use AutoHelper**:
- Cloud exports (OneDrive, Google Drive) - use direct APIs
- Browser downloads - return buffer directly
- Any OAuth operations - handled in AutoArt backend

---

## Related Documentation

- [Finance Management Epic #173](https://github.com/ok-very/autoart/issues/173)
- [AutoHelper README](https://github.com/ok-very/AutoHelper/blob/main/README.md)
- [Microsoft Graph Files API](https://learn.microsoft.com/en-us/graph/api/resources/onedrive)
- [Google Drive API](https://developers.google.com/drive/api/guides/manage-uploads)

---

**Last Updated**: 2026-01-29  
**Authors**: AutoArt Team  
**Status**: Ready for implementation - OAuth in AutoArt, AutoHelper as optional local fallback
