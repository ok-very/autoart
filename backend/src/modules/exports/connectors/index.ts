/**
 * Export Connectors Index
 *
 * Re-exports all export connector types and classes.
 */

// Unified Google Client
export { GoogleClient } from './google-client.js';
export type {
    GoogleClientConfig,
    GoogleColor,
    GoogleDimension,
    DriveFile,
    DriveFileList,
    Spreadsheet,
    Sheet,
    SheetProperties,
    GridProperties,
    GridData,
    RowData,
    CellData,
    ExtendedValue,
    CellFormat,
    TextFormat,
    ValueRange,
    SpreadsheetRequest,
    Presentation,
    Slide,
    PageElement,
    Shape,
    TextContent,
    Table,
    Image as SlideImage,
    PresentationRequest,
    SlideLayoutReference,
} from './google-client.js';

// Legacy Google Docs Client (for backwards compatibility)
export { GoogleDocsClient } from './google-docs-client.js';
export type {
    GoogleDocsClientConfig,
    GoogleDocument,
    GoogleDocumentBody,
    GoogleDocumentElement,
    GoogleParagraph,
    GoogleParagraphElement,
    GoogleTextRun,
    GoogleTextStyle,
    GoogleParagraphStyle,
    GoogleBullet,
    BatchUpdateRequest,
    GoogleDocumentRequest,
    BatchUpdateResponse,
} from './google-docs-client.js';

// Google Docs Connector
export { GoogleDocsConnector } from './google-docs-connector.js';
export type {
    GoogleDocsConnectorConfig,
    ParsedProjectHeader,
    DocumentAnalysis,
    WriteDocumentResult,
} from './google-docs-connector.js';

// Google Sheets Connector
export { GoogleSheetsConnector } from './google-sheets-connector.js';
export type {
    GoogleSheetsConnectorConfig,
    SheetsExportOptions,
    WriteSpreadsheetResult,
} from './google-sheets-connector.js';

// Google Slides Connector
export { GoogleSlidesConnector } from './google-slides-connector.js';
export type {
    GoogleSlidesConnectorConfig,
    SlidesExportOptions,
    WritePresentationResult,
} from './google-slides-connector.js';
