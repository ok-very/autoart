/**
 * OneDrive Client
 *
 * Provides file upload and folder management via Microsoft Graph API.
 * Uses direct REST API calls matching the GoogleClient pattern.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface OneDriveClientConfig {
    accessToken: string;
}

// ============================================================================
// TYPES
// ============================================================================

export interface OneDriveFile {
    id: string;
    name: string;
    webUrl: string;
    size?: number;
    createdDateTime?: string;
    lastModifiedDateTime?: string;
    file?: { mimeType: string };
    folder?: { childCount: number };
    parentReference?: {
        driveId: string;
        id: string;
        path: string;
    };
}

// ============================================================================
// CLIENT CLASS
// ============================================================================

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export class OneDriveClient {
    private accessToken: string;

    constructor(config: OneDriveClientConfig) {
        this.accessToken = config.accessToken;
    }

    // ========================================================================
    // FILE OPERATIONS
    // ========================================================================

    /**
     * Upload a file to OneDrive at the specified folder path.
     * Uses the simple upload API (PUT to item path) for files under 4MB.
     * Default folder: /AutoArt/Invoices
     */
    async uploadFile(
        fileName: string,
        buffer: Buffer,
        folderPath: string = '/AutoArt/Invoices'
    ): Promise<OneDriveFile> {
        // Ensure the folder exists
        await this.ensureFolderExists(folderPath);

        // Upload via PUT to path-based URL
        const encodedPath = encodeURIComponent(`${folderPath}/${fileName}`.replace(/^\//, ''));
        const uploadUrl = `${GRAPH_BASE}/me/drive/root:/${encodedPath}:/content`;

        return this.request<OneDriveFile>(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            },
            body: new Uint8Array(buffer),
        });
    }

    /**
     * Get file metadata by path.
     */
    async getFileByPath(path: string): Promise<OneDriveFile | null> {
        try {
            return await this.request<OneDriveFile>(
                `${GRAPH_BASE}/me/drive/root:/${encodeURIComponent(path)}`
            );
        } catch (err) {
            if (err instanceof Error && err.message.includes('(404)')) return null;
            throw err;
        }
    }

    // ========================================================================
    // FOLDER OPERATIONS
    // ========================================================================

    /**
     * Ensure a folder path exists, creating segments as needed.
     * Path format: /AutoArt/Invoices
     */
    async ensureFolderExists(folderPath: string): Promise<void> {
        const parts = folderPath.split('/').filter(Boolean);
        let currentPath = '';

        for (const part of parts) {
            currentPath += `/${part}`;
            const encodedPath = encodeURIComponent(currentPath.replace(/^\//, ''));

            // Check if folder exists
            const checkUrl = `${GRAPH_BASE}/me/drive/root:/${encodedPath}`;
            const checkResponse = await fetch(checkUrl, {
                headers: { Authorization: `Bearer ${this.accessToken}` },
            });

            if (checkResponse.status === 404) {
                // Folder doesn't exist — create it
                const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
                const parentUrl = parentPath
                    ? `${GRAPH_BASE}/me/drive/root:/${encodeURIComponent(parentPath.replace(/^\//, ''))}:/children`
                    : `${GRAPH_BASE}/me/drive/root/children`;

                await this.request(parentUrl, {
                    method: 'POST',
                    body: JSON.stringify({
                        name: part,
                        folder: {},
                        '@microsoft.graph.conflictBehavior': 'replace',
                    }),
                });
            } else if (!checkResponse.ok) {
                const errorText = await checkResponse.text();
                throw new Error(`OneDrive folder check failed (${checkResponse.status}): ${errorText}`);
            }
        }
    }

    // ========================================================================
    // CONNECTION TEST
    // ========================================================================

    /**
     * Test connection by fetching root drive info.
     */
    async testConnection(): Promise<{ connected: boolean; error?: string }> {
        try {
            await this.request(`${GRAPH_BASE}/me/drive`);
            return { connected: true };
        } catch (error) {
            return {
                connected: false,
                error: error instanceof Error ? error.message : 'Connection failed',
            };
        }
    }

    // ========================================================================
    // PRIVATE HELPERS
    // ========================================================================

    private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.accessToken}`,
        };

        // Set Content-Type for JSON bodies (not for binary uploads)
        if (options.body && typeof options.body === 'string') {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, {
            ...options,
            headers: {
                ...headers,
                ...(options.headers as Record<string, string> | undefined),
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OneDrive API error (${response.status}): ${error}`);
        }

        const text = await response.text();
        if (!text) return {} as T;

        return JSON.parse(text);
    }
}

export default OneDriveClient;
