/**
 * Unified Google Workspace API Client
 *
 * Supports Docs, Sheets, Slides, and Drive operations.
 * Uses direct REST API calls for lightweight integration.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface GoogleClientConfig {
    accessToken: string;
}

// API Base URLs
const API_BASES = {
    docs: 'https://docs.googleapis.com/v1',
    sheets: 'https://sheets.googleapis.com/v4',
    slides: 'https://slides.googleapis.com/v1',
    drive: 'https://www.googleapis.com/drive/v3',
} as const;

// ============================================================================
// SHARED TYPES
// ============================================================================

export interface GoogleColor {
    red?: number;
    green?: number;
    blue?: number;
}

export interface GoogleDimension {
    magnitude: number;
    unit: 'PT' | 'EMU' | 'PIXEL';
}

// ============================================================================
// DRIVE TYPES
// ============================================================================

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime?: string;
    createdTime?: string;
    webViewLink?: string;
    iconLink?: string;
    parents?: string[];
}

export interface DriveFileList {
    files: DriveFile[];
    nextPageToken?: string;
}

export type DriveMimeType =
    | 'application/vnd.google-apps.document'
    | 'application/vnd.google-apps.spreadsheet'
    | 'application/vnd.google-apps.presentation'
    | 'application/vnd.google-apps.folder';

// ============================================================================
// SHEETS TYPES
// ============================================================================

export interface Spreadsheet {
    spreadsheetId: string;
    properties: SpreadsheetProperties;
    sheets: Sheet[];
    spreadsheetUrl?: string;
}

export interface SpreadsheetProperties {
    title: string;
    locale?: string;
    timeZone?: string;
}

export interface Sheet {
    properties: SheetProperties;
    data?: GridData[];
}

export interface SheetProperties {
    sheetId: number;
    title: string;
    index: number;
    gridProperties?: GridProperties;
}

export interface GridProperties {
    rowCount: number;
    columnCount: number;
    frozenRowCount?: number;
    frozenColumnCount?: number;
}

export interface GridData {
    startRow?: number;
    startColumn?: number;
    rowData: RowData[];
}

export interface RowData {
    values: CellData[];
}

export interface CellData {
    userEnteredValue?: ExtendedValue;
    effectiveValue?: ExtendedValue;
    formattedValue?: string;
    userEnteredFormat?: CellFormat;
}

export interface ExtendedValue {
    stringValue?: string;
    numberValue?: number;
    boolValue?: boolean;
    formulaValue?: string;
}

export interface CellFormat {
    backgroundColor?: { red?: number; green?: number; blue?: number };
    textFormat?: TextFormat;
    horizontalAlignment?: 'LEFT' | 'CENTER' | 'RIGHT';
    verticalAlignment?: 'TOP' | 'MIDDLE' | 'BOTTOM';
    wrapStrategy?: 'OVERFLOW_CELL' | 'CLIP' | 'WRAP';
}

export interface TextFormat {
    foregroundColor?: GoogleColor;
    fontFamily?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
}

export interface ValueRange {
    range: string;
    majorDimension?: 'ROWS' | 'COLUMNS';
    values: unknown[][];
}

export interface BatchUpdateSpreadsheetRequest {
    requests: SpreadsheetRequest[];
}

export interface SpreadsheetRequest {
    updateCells?: UpdateCellsRequest;
    appendCells?: AppendCellsRequest;
    insertDimension?: InsertDimensionRequest;
    deleteDimension?: DeleteDimensionRequest;
    updateSheetProperties?: UpdateSheetPropertiesRequest;
    addSheet?: AddSheetRequest;
}

export interface UpdateCellsRequest {
    rows: RowData[];
    fields: string;
    start?: GridCoordinate;
    range?: GridRange;
}

export interface AppendCellsRequest {
    sheetId: number;
    rows: RowData[];
    fields: string;
}

export interface InsertDimensionRequest {
    range: DimensionRange;
    inheritFromBefore?: boolean;
}

export interface DeleteDimensionRequest {
    range: DimensionRange;
}

export interface DimensionRange {
    sheetId: number;
    dimension: 'ROWS' | 'COLUMNS';
    startIndex: number;
    endIndex: number;
}

export interface GridCoordinate {
    sheetId: number;
    rowIndex: number;
    columnIndex: number;
}

export interface GridRange {
    sheetId: number;
    startRowIndex?: number;
    endRowIndex?: number;
    startColumnIndex?: number;
    endColumnIndex?: number;
}

export interface UpdateSheetPropertiesRequest {
    properties: Partial<SheetProperties>;
    fields: string;
}

export interface AddSheetRequest {
    properties: Partial<SheetProperties>;
}

// ============================================================================
// SLIDES TYPES
// ============================================================================

export interface Presentation {
    presentationId: string;
    title: string;
    slides: Slide[];
    pageSize?: PageSize;
}

export interface PageSize {
    width: GoogleDimension;
    height: GoogleDimension;
}

export interface Slide {
    objectId: string;
    pageElements?: PageElement[];
    slideProperties?: SlideProperties;
}

export interface SlideProperties {
    layoutObjectId?: string;
    masterObjectId?: string;
}

export interface PageElement {
    objectId: string;
    size?: Size;
    transform?: AffineTransform;
    shape?: Shape;
    table?: Table;
    image?: Image;
}

export interface Size {
    width: GoogleDimension;
    height: GoogleDimension;
}

export interface AffineTransform {
    scaleX: number;
    scaleY: number;
    translateX: number;
    translateY: number;
    unit: 'EMU' | 'PT';
}

export interface Shape {
    shapeType: string;
    text?: TextContent;
}

export interface TextContent {
    textElements: TextElement[];
}

export interface TextElement {
    startIndex?: number;
    endIndex?: number;
    paragraphMarker?: ParagraphMarker;
    textRun?: SlideTextRun;
}

export interface ParagraphMarker {
    style?: ParagraphStyle;
    bullet?: Bullet;
}

export interface ParagraphStyle {
    alignment?: 'START' | 'CENTER' | 'END' | 'JUSTIFIED';
    lineSpacing?: number;
}

export interface Bullet {
    listId: string;
    nestingLevel?: number;
    glyph?: string;
}

export interface SlideTextRun {
    content: string;
    style?: SlideTextStyle;
}

export interface SlideTextStyle {
    foregroundColor?: OpaqueColor;
    backgroundColor?: OpaqueColor;
    fontSize?: GoogleDimension;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    fontFamily?: string;
}

export interface OpaqueColor {
    rgbColor?: GoogleColor;
}

export interface Table {
    rows: number;
    columns: number;
    tableRows: TableRow[];
}

export interface TableRow {
    rowHeight?: GoogleDimension;
    tableCells: TableCell[];
}

export interface TableCell {
    text?: TextContent;
    tableCellProperties?: TableCellProperties;
}

export interface TableCellProperties {
    contentAlignment?: 'TOP' | 'MIDDLE' | 'BOTTOM';
}

export interface Image {
    sourceUrl?: string;
    contentUrl?: string;
}

export interface BatchUpdatePresentationRequest {
    requests: PresentationRequest[];
}

export interface PresentationRequest {
    createSlide?: CreateSlideRequest;
    deleteObject?: DeleteObjectRequest;
    insertText?: InsertTextRequest;
    createShape?: CreateShapeRequest;
    createTable?: CreateTableRequest;
}

export interface CreateSlideRequest {
    objectId?: string;
    insertionIndex?: number;
    slideLayoutReference?: SlideLayoutReference;
}

export interface SlideLayoutReference {
    predefinedLayout?: 'BLANK' | 'CAPTION_ONLY' | 'TITLE' | 'TITLE_AND_BODY' | 'TITLE_AND_TWO_COLUMNS' | 'TITLE_ONLY' | 'SECTION_HEADER' | 'SECTION_TITLE_AND_DESCRIPTION' | 'ONE_COLUMN_TEXT' | 'MAIN_POINT' | 'BIG_NUMBER';
}

export interface DeleteObjectRequest {
    objectId: string;
}

export interface InsertTextRequest {
    objectId: string;
    insertionIndex?: number;
    text: string;
}

export interface CreateShapeRequest {
    objectId?: string;
    shapeType: string;
    elementProperties: PageElementProperties;
}

export interface PageElementProperties {
    pageObjectId: string;
    size?: Size;
    transform?: AffineTransform;
}

export interface CreateTableRequest {
    objectId?: string;
    elementProperties: PageElementProperties;
    rows: number;
    columns: number;
}

// ============================================================================
// CLIENT CLASS
// ============================================================================

export class GoogleClient {
    private accessToken: string;

    constructor(config: GoogleClientConfig) {
        this.accessToken = config.accessToken;
    }

    // ========================================================================
    // DRIVE OPERATIONS
    // ========================================================================

    /**
     * List files in Drive with optional filtering
     */
    async listFiles(options: {
        mimeType?: DriveMimeType;
        query?: string;
        pageSize?: number;
        pageToken?: string;
        folderId?: string;
    } = {}): Promise<DriveFileList> {
        const queryParts: string[] = [];

        if (options.mimeType) {
            queryParts.push(`mimeType='${options.mimeType}'`);
        }
        if (options.folderId) {
            queryParts.push(`'${options.folderId}' in parents`);
        }
        if (options.query) {
            queryParts.push(options.query);
        }

        const params = new URLSearchParams({
            fields: 'files(id,name,mimeType,modifiedTime,createdTime,webViewLink,iconLink,parents),nextPageToken',
            pageSize: String(options.pageSize ?? 50),
        });

        if (queryParts.length > 0) {
            params.set('q', queryParts.join(' and '));
        }
        if (options.pageToken) {
            params.set('pageToken', options.pageToken);
        }

        return this.request(`${API_BASES.drive}/files?${params}`);
    }

    /**
     * Get file metadata
     */
    async getFile(fileId: string): Promise<DriveFile> {
        const params = new URLSearchParams({
            fields: 'id,name,mimeType,modifiedTime,createdTime,webViewLink,iconLink,parents',
        });
        return this.request(`${API_BASES.drive}/files/${fileId}?${params}`);
    }

    /**
     * Create a folder
     */
    async createFolder(name: string, parentId?: string): Promise<DriveFile> {
        const metadata: Record<string, unknown> = {
            name,
            mimeType: 'application/vnd.google-apps.folder',
        };
        if (parentId) {
            metadata.parents = [parentId];
        }

        return this.request(`${API_BASES.drive}/files`, {
            method: 'POST',
            body: JSON.stringify(metadata),
        });
    }

    /**
     * Copy a file
     */
    async copyFile(fileId: string, name: string, parentId?: string): Promise<DriveFile> {
        const metadata: Record<string, unknown> = { name };
        if (parentId) {
            metadata.parents = [parentId];
        }

        return this.request(`${API_BASES.drive}/files/${fileId}/copy`, {
            method: 'POST',
            body: JSON.stringify(metadata),
        });
    }

    /**
     * Delete a file
     */
    async deleteFile(fileId: string): Promise<void> {
        await this.request(`${API_BASES.drive}/files/${fileId}`, {
            method: 'DELETE',
        });
    }

    /**
     * Move file to different folder
     */
    async moveFile(fileId: string, newParentId: string, oldParentId?: string): Promise<DriveFile> {
        const params = new URLSearchParams({
            addParents: newParentId,
            fields: 'id,name,mimeType,webViewLink,parents',
        });
        if (oldParentId) {
            params.set('removeParents', oldParentId);
        }

        return this.request(`${API_BASES.drive}/files/${fileId}?${params}`, {
            method: 'PATCH',
        });
    }

    /**
     * Upload a binary file to Drive using multipart upload.
     * Returns the created file metadata including webViewLink.
     */
    async uploadFile(
        fileName: string,
        buffer: Buffer,
        mimeType: string,
        folderId?: string
    ): Promise<DriveFile> {
        const metadata: Record<string, unknown> = {
            name: fileName,
        };
        if (folderId) {
            metadata.parents = [folderId];
        }

        // Build multipart body using binary Buffer.concat for correct file content
        const boundary = `----autoart-upload-${Date.now()}`;
        const metadataJson = JSON.stringify(metadata);

        const preamble = Buffer.from(
            `--${boundary}\r\n` +
            `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
            metadataJson +
            `\r\n--${boundary}\r\n` +
            `Content-Type: ${mimeType}\r\n\r\n`,
            'utf-8'
        );
        const epilogue = Buffer.from(`\r\n--${boundary}--`, 'utf-8');
        const body = Buffer.concat([preamble, buffer, epilogue]);

        const response = await fetch(
            `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,parents`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`,
                },
                body,
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Google Drive upload error (${response.status}): ${error}`);
        }

        return response.json() as Promise<DriveFile>;
    }

    /**
     * Find a folder by name, or create it if it doesn't exist.
     * Returns the folder's Drive file ID.
     */
    async findOrCreateFolder(folderName: string, parentId?: string): Promise<string> {
        // Search for existing folder
        const queryParts = [
            `name='${folderName}'`,
            `mimeType='application/vnd.google-apps.folder'`,
            `trashed=false`,
        ];
        if (parentId) {
            queryParts.push(`'${parentId}' in parents`);
        }

        const params = new URLSearchParams({
            q: queryParts.join(' and '),
            fields: 'files(id,name)',
            pageSize: '1',
        });

        const result = await this.request<DriveFileList>(`${API_BASES.drive}/files?${params}`);

        if (result.files.length > 0) {
            return result.files[0].id;
        }

        // Create folder
        const folder = await this.createFolder(folderName, parentId);
        return folder.id;
    }

    // ========================================================================
    // SHEETS OPERATIONS
    // ========================================================================

    /**
     * Create a new spreadsheet
     */
    async createSpreadsheet(title: string): Promise<Spreadsheet> {
        return this.request(`${API_BASES.sheets}/spreadsheets`, {
            method: 'POST',
            body: JSON.stringify({
                properties: { title },
            }),
        });
    }

    /**
     * Get spreadsheet metadata and data
     */
    async getSpreadsheet(spreadsheetId: string, includeData = false): Promise<Spreadsheet> {
        const params = new URLSearchParams();
        if (includeData) {
            params.set('includeGridData', 'true');
        }
        const query = params.toString();
        return this.request(`${API_BASES.sheets}/spreadsheets/${spreadsheetId}${query ? `?${query}` : ''}`);
    }

    /**
     * Read values from a range
     */
    async getValues(spreadsheetId: string, range: string): Promise<ValueRange> {
        const encodedRange = encodeURIComponent(range);
        return this.request(`${API_BASES.sheets}/spreadsheets/${spreadsheetId}/values/${encodedRange}`);
    }

    /**
     * Write values to a range
     */
    async updateValues(
        spreadsheetId: string,
        range: string,
        values: unknown[][],
        inputOption: 'RAW' | 'USER_ENTERED' = 'USER_ENTERED'
    ): Promise<{ updatedCells: number; updatedRows: number; updatedColumns: number }> {
        const encodedRange = encodeURIComponent(range);
        const params = new URLSearchParams({ valueInputOption: inputOption });

        return this.request(
            `${API_BASES.sheets}/spreadsheets/${spreadsheetId}/values/${encodedRange}?${params}`,
            {
                method: 'PUT',
                body: JSON.stringify({ values }),
            }
        );
    }

    /**
     * Append values to a sheet
     */
    async appendValues(
        spreadsheetId: string,
        range: string,
        values: unknown[][],
        inputOption: 'RAW' | 'USER_ENTERED' = 'USER_ENTERED'
    ): Promise<{ updates: { updatedCells: number; updatedRows: number } }> {
        const encodedRange = encodeURIComponent(range);
        const params = new URLSearchParams({
            valueInputOption: inputOption,
            insertDataOption: 'INSERT_ROWS',
        });

        return this.request(
            `${API_BASES.sheets}/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?${params}`,
            {
                method: 'POST',
                body: JSON.stringify({ values }),
            }
        );
    }

    /**
     * Batch update spreadsheet (formatting, adding sheets, etc.)
     */
    async batchUpdateSpreadsheet(
        spreadsheetId: string,
        requests: SpreadsheetRequest[]
    ): Promise<{ spreadsheetId: string; replies: unknown[] }> {
        return this.request(
            `${API_BASES.sheets}/spreadsheets/${spreadsheetId}:batchUpdate`,
            {
                method: 'POST',
                body: JSON.stringify({ requests }),
            }
        );
    }

    /**
     * Clear values from a range
     */
    async clearValues(spreadsheetId: string, range: string): Promise<{ clearedRange: string }> {
        const encodedRange = encodeURIComponent(range);
        return this.request(
            `${API_BASES.sheets}/spreadsheets/${spreadsheetId}/values/${encodedRange}:clear`,
            { method: 'POST' }
        );
    }

    // ========================================================================
    // SLIDES OPERATIONS
    // ========================================================================

    /**
     * Create a new presentation
     */
    async createPresentation(title: string): Promise<Presentation> {
        return this.request(`${API_BASES.slides}/presentations`, {
            method: 'POST',
            body: JSON.stringify({ title }),
        });
    }

    /**
     * Get presentation
     */
    async getPresentation(presentationId: string): Promise<Presentation> {
        return this.request(`${API_BASES.slides}/presentations/${presentationId}`);
    }

    /**
     * Batch update presentation
     */
    async batchUpdatePresentation(
        presentationId: string,
        requests: PresentationRequest[]
    ): Promise<{ presentationId: string; replies: unknown[] }> {
        return this.request(
            `${API_BASES.slides}/presentations/${presentationId}:batchUpdate`,
            {
                method: 'POST',
                body: JSON.stringify({ requests }),
            }
        );
    }

    /**
     * Add a slide
     */
    async addSlide(
        presentationId: string,
        layout: SlideLayoutReference['predefinedLayout'] = 'BLANK',
        insertionIndex?: number
    ): Promise<{ objectId: string }> {
        const result = await this.batchUpdatePresentation(presentationId, [
            {
                createSlide: {
                    insertionIndex,
                    slideLayoutReference: { predefinedLayout: layout },
                },
            },
        ]);
        const reply = result.replies[0] as { createSlide?: { objectId: string } };
        return { objectId: reply.createSlide?.objectId ?? '' };
    }

    /**
     * Delete a slide or element
     */
    async deleteObject(presentationId: string, objectId: string): Promise<void> {
        await this.batchUpdatePresentation(presentationId, [
            { deleteObject: { objectId } },
        ]);
    }

    // ========================================================================
    // DOCS OPERATIONS (from existing client)
    // ========================================================================

    /**
     * Create a document
     */
    async createDocument(title: string): Promise<{ documentId: string; title: string }> {
        return this.request(`${API_BASES.docs}/documents`, {
            method: 'POST',
            body: JSON.stringify({ title }),
        });
    }

    /**
     * Get document
     */
    async getDocument(documentId: string): Promise<unknown> {
        return this.request(`${API_BASES.docs}/documents/${documentId}`);
    }

    /**
     * Batch update document
     */
    async batchUpdateDocument(
        documentId: string,
        requests: unknown[]
    ): Promise<{ documentId: string; replies: unknown[] }> {
        return this.request(
            `${API_BASES.docs}/documents/${documentId}:batchUpdate`,
            {
                method: 'POST',
                body: JSON.stringify({ requests }),
            }
        );
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    /**
     * Test connection by listing files
     */
    async testConnection(): Promise<{ connected: boolean; error?: string }> {
        try {
            await this.listFiles({ pageSize: 1 });
            return { connected: true };
        } catch (error) {
            return {
                connected: false,
                error: error instanceof Error ? error.message : 'Connection failed',
            };
        }
    }

    /**
     * List documents
     */
    async listDocuments(): Promise<DriveFile[]> {
        const result = await this.listFiles({ mimeType: 'application/vnd.google-apps.document' });
        return result.files;
    }

    /**
     * List spreadsheets
     */
    async listSpreadsheets(): Promise<DriveFile[]> {
        const result = await this.listFiles({ mimeType: 'application/vnd.google-apps.spreadsheet' });
        return result.files;
    }

    /**
     * List presentations
     */
    async listPresentations(): Promise<DriveFile[]> {
        const result = await this.listFiles({ mimeType: 'application/vnd.google-apps.presentation' });
        return result.files;
    }

    // ========================================================================
    // PRIVATE HELPERS
    // ========================================================================

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

        // Handle empty responses (like DELETE)
        const text = await response.text();
        if (!text) return {} as T;

        return JSON.parse(text);
    }
}

export default GoogleClient;
