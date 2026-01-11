/**
 * Google Docs API Client
 *
 * Wrapper around Google APIs for Docs and Drive operations.
 * Handles authentication via OAuth2 tokens.
 */

// Note: Requires googleapis package: npm install googleapis
// For now, we use direct REST API calls to avoid heavy dependency

export interface GoogleDocsClientConfig {
    accessToken: string;
}

export interface GoogleDocument {
    documentId: string;
    title: string;
    body: GoogleDocumentBody;
    revisionId?: string;
}

export interface GoogleDocumentBody {
    content: GoogleDocumentElement[];
}

export interface GoogleDocumentElement {
    startIndex: number;
    endIndex: number;
    paragraph?: GoogleParagraph;
    sectionBreak?: GoogleSectionBreak;
    table?: GoogleTable;
}

export interface GoogleParagraph {
    elements: GoogleParagraphElement[];
    paragraphStyle?: GoogleParagraphStyle;
    bullet?: GoogleBullet;
}

export interface GoogleParagraphElement {
    startIndex: number;
    endIndex: number;
    textRun?: GoogleTextRun;
}

export interface GoogleTextRun {
    content: string;
    textStyle?: GoogleTextStyle;
}

export interface GoogleTextStyle {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    foregroundColor?: { color: { rgbColor: { red?: number; green?: number; blue?: number } } };
    backgroundColor?: { color: { rgbColor: { red?: number; green?: number; blue?: number } } };
    fontSize?: { magnitude: number; unit: string };
    weightedFontFamily?: { fontFamily: string };
}

export interface GoogleParagraphStyle {
    namedStyleType?: string;
    alignment?: string;
    lineSpacing?: number;
    spaceAbove?: { magnitude: number; unit: string };
    spaceBelow?: { magnitude: number; unit: string };
}

export interface GoogleBullet {
    listId: string;
    nestingLevel?: number;
}

export interface GoogleSectionBreak {
    sectionStyle?: Record<string, unknown>;
}

export interface GoogleTable {
    rows: number;
    columns: number;
    tableRows: GoogleTableRow[];
}

export interface GoogleTableRow {
    tableCells: GoogleTableCell[];
}

export interface GoogleTableCell {
    content: GoogleDocumentElement[];
}

export interface BatchUpdateRequest {
    requests: GoogleDocumentRequest[];
}

export interface GoogleDocumentRequest {
    insertText?: {
        location: { index: number };
        text: string;
    };
    deleteContentRange?: {
        range: { startIndex: number; endIndex: number };
    };
    updateTextStyle?: {
        range: { startIndex: number; endIndex: number };
        textStyle: GoogleTextStyle;
        fields: string;
    };
    updateParagraphStyle?: {
        range: { startIndex: number; endIndex: number };
        paragraphStyle: GoogleParagraphStyle;
        fields: string;
    };
    createParagraphBullets?: {
        range: { startIndex: number; endIndex: number };
        bulletPreset: string;
    };
}

export interface BatchUpdateResponse {
    documentId: string;
    replies: unknown[];
    writeControl: { requiredRevisionId: string };
}

// ============================================================================
// CLIENT CLASS
// ============================================================================

const DOCS_API_BASE = 'https://docs.googleapis.com/v1';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

export class GoogleDocsClient {
    private accessToken: string;

    constructor(config: GoogleDocsClientConfig) {
        this.accessToken = config.accessToken;
    }

    // ============================================================================
    // DOCUMENT OPERATIONS
    // ============================================================================

    /**
     * Get a document by ID.
     */
    async getDocument(documentId: string): Promise<GoogleDocument> {
        const response = await this.request<GoogleDocument>(
            `${DOCS_API_BASE}/documents/${documentId}`
        );
        return response;
    }

    /**
     * Create a new document.
     */
    async createDocument(title: string): Promise<GoogleDocument> {
        const response = await this.request<GoogleDocument>(
            `${DOCS_API_BASE}/documents`,
            {
                method: 'POST',
                body: JSON.stringify({ title }),
            }
        );
        return response;
    }

    /**
     * Update document content with batch requests.
     */
    async batchUpdate(
        documentId: string,
        requests: GoogleDocumentRequest[]
    ): Promise<BatchUpdateResponse> {
        const response = await this.request<BatchUpdateResponse>(
            `${DOCS_API_BASE}/documents/${documentId}:batchUpdate`,
            {
                method: 'POST',
                body: JSON.stringify({ requests }),
            }
        );
        return response;
    }

    /**
     * Insert text at a specific index.
     */
    async insertText(documentId: string, index: number, text: string): Promise<void> {
        await this.batchUpdate(documentId, [
            {
                insertText: {
                    location: { index },
                    text,
                },
            },
        ]);
    }

    /**
     * Replace document content entirely.
     */
    async replaceContent(documentId: string, newContent: string): Promise<void> {
        // Get current document to find content length
        const doc = await this.getDocument(documentId);
        const body = doc.body?.content ?? [];

        // Find the last index (excluding the final newline that's always present)
        const lastElement = body[body.length - 1];
        const endIndex = lastElement ? lastElement.endIndex - 1 : 1;

        const requests: GoogleDocumentRequest[] = [];

        // Delete existing content (if any)
        if (endIndex > 1) {
            requests.push({
                deleteContentRange: {
                    range: { startIndex: 1, endIndex },
                },
            });
        }

        // Insert new content
        requests.push({
            insertText: {
                location: { index: 1 },
                text: newContent,
            },
        });

        await this.batchUpdate(documentId, requests);
    }

    // ============================================================================
    // DRIVE OPERATIONS
    // ============================================================================

    /**
     * List files in user's Drive (for selecting existing docs).
     */
    async listDocuments(query?: string): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
        const params = new URLSearchParams({
            q: query ?? "mimeType='application/vnd.google-apps.document'",
            fields: 'files(id,name,modifiedTime)',
            pageSize: '50',
        });

        const response = await this.request<{
            files: Array<{ id: string; name: string; modifiedTime: string }>;
        }>(`${DRIVE_API_BASE}/files?${params}`);

        return response.files ?? [];
    }

    /**
     * Get file metadata from Drive.
     */
    async getFileMetadata(fileId: string): Promise<{ id: string; name: string; modifiedTime: string; webViewLink: string }> {
        const params = new URLSearchParams({
            fields: 'id,name,modifiedTime,webViewLink',
        });

        return this.request(`${DRIVE_API_BASE}/files/${fileId}?${params}`);
    }

    /**
     * Copy a document (for creating from template).
     */
    async copyDocument(
        sourceDocumentId: string,
        newTitle: string
    ): Promise<{ id: string; name: string; webViewLink: string }> {
        const response = await this.request<{ id: string; name: string; webViewLink: string }>(
            `${DRIVE_API_BASE}/files/${sourceDocumentId}/copy`,
            {
                method: 'POST',
                body: JSON.stringify({
                    name: newTitle,
                }),
            }
        );
        return response;
    }

    // ============================================================================
    // PRIVATE HELPERS
    // ============================================================================

    private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
        const response = await fetch(url, {
            ...options,
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Google API error (${response.status}): ${error}`);
        }

        return response.json();
    }
}

export default GoogleDocsClient;
