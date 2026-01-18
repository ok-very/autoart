/**
 * Monday.com Connector
 *
 * Traverses Monday.com hierarchy (boards → groups → items → subitems)
 * and normalizes data into MondayDataNode tree structure.
 *
 * Responsibilities:
 * - Board schema discovery
 * - Hierarchy traversal with pagination
 * - Column value normalization
 * - Data streaming via async iterators
 */

import { MondayClient } from './monday-client.js';

// ============================================================================
// TYPES
// ============================================================================

export interface MondayConnectorConfig {
    boardIds: string[];
    includeSubitems?: boolean;
    includeUpdates?: boolean;
    includeArchived?: boolean;
}

export type MondayWebhookEventType =
    | 'create_item'
    | 'change_column_value'
    | 'create_subitem'
    | 'change_subitem_column_value';

export interface MondayColumnValue {
    id: string;
    title: string;
    type: string;
    text: string | null;
    value: unknown;
}

export interface MondayColumnSchema {
    id: string;
    title: string;
    type: string;
    settings?: Record<string, unknown>;
    sampleValues: string[];
}

export interface MondayBoardSchema {
    boardId: string;
    boardName: string;
    columns: MondayColumnSchema[];
    groups: Array<{ id: string; title: string; color: string }>;
    hierarchyType: 'classic' | 'multi_level';
    itemCount: number;
}

export interface MondayDataNode {
    type: 'board' | 'group' | 'item' | 'subitem';
    id: string;
    name: string;
    columnValues: MondayColumnValue[];
    children: MondayDataNode[];
    parent?: MondayDataNode;
    metadata: {
        boardId?: string;
        boardName?: string;
        groupId?: string;
        groupTitle?: string;
        parentItemId?: string;
        creator?: { id: string; name: string };
        createdAt?: string;
        updatedAt?: string;
        state?: 'active' | 'archived' | 'deleted';
    };
}

// ============================================================================
// GRAPHQL QUERIES
// ============================================================================

const CREATE_WEBHOOK_MUTATION = `
  mutation CreateWebhook($boardId: Int!, $url: String!, $event: WebhookEventType!, $config: JSON) {
    create_webhook(board_id: $boardId, url: $url, event: $event, config: $config) {
      id
      board_id
    }
  }
`;

const DELETE_WEBHOOK_MUTATION = `
  mutation DeleteWebhook($id: ID!) {
    delete_webhook(id: $id) {
      id
      board_id
    }
  }
`;

const BOARD_SCHEMA_QUERY = `
  query DiscoverSchema($boardId: ID!) {
    boards(ids: [$boardId]) {
      id
      name
      hierarchy_type
      items_count
      columns {
        id
        title
        type
        settings_str
      }
      groups {
        id
        title
        color
      }
    }
  }
`;

const BOARD_ITEMS_QUERY = `
  query GetBoardItems($boardId: ID!, $cursor: String, $limit: Int!) {
    boards(ids: [$boardId]) {
      items_page(limit: $limit, cursor: $cursor) {
        cursor
        items {
          id
          name
          group {
            id
            title
          }
          created_at
          updated_at
          creator {
            id
            name
          }
          state
          column_values {
            id
            text
            value
            type
          }
          subitems {
            id
            name
            created_at
            updated_at
            column_values {
              id
              text
              value
              type
            }
          }
        }
      }
    }
  }
`;

// ============================================================================
// CONNECTOR CLASS
// ============================================================================

export class MondayConnector {
    private client: MondayClient;

    constructor(token: string) {
        this.client = new MondayClient({ token });
    }

    /**
     * Discover board schema without fetching all items.
     * Use this for initial column mapping and entity inference.
     */
    async discoverBoardSchema(boardId: string): Promise<MondayBoardSchema> {
        interface SchemaResponse {
            boards: Array<{
                id: string;
                name: string;
                hierarchy_type: string;
                items_count: number;
                columns: Array<{
                    id: string;
                    title: string;
                    type: string;
                    settings_str: string;
                }>;
                groups: Array<{
                    id: string;
                    title: string;
                    color: string;
                }>;
            }>;
        }

        const data = await this.client.query<SchemaResponse>(BOARD_SCHEMA_QUERY, {
            boardId,
        });

        const board = data.boards[0];
        if (!board) {
            throw new Error(`Board ${boardId} not found`);
        }

        const boardSchema: MondayBoardSchema = {
            boardId: board.id,
            boardName: board.name,
            hierarchyType: board.hierarchy_type as 'classic' | 'multi_level',
            itemCount: board.items_count,
            groups: board.groups,
            columns: board.columns.map((col) => ({
                id: col.id,
                title: col.title,
                type: col.type,
                settings: col.settings_str ? JSON.parse(col.settings_str) : undefined,
                sampleValues: [], // Will be populated below
            })),
        };

        try {
            // Fetch a small sample of items to populate sampleValues
            // We only need a few items to get representative samples
            const sampleItemsPage = await this.fetchItemsPage(boardId, null, 10);

            if (sampleItemsPage.items.length > 0) {
                for (const col of boardSchema.columns) {
                    const samples = new Set<string>();

                    for (const item of sampleItemsPage.items) {
                        if (samples.size >= 3) break;

                        const cv = item.column_values.find(c => c.id === col.id);
                        if (cv) {
                            // Extract meaningful text representation
                            const text = cv.text;
                            // Skip empty/null values
                            if (text && text.trim() !== '') {
                                samples.add(text);
                            }
                        }
                    }

                    col.sampleValues = Array.from(samples);
                }
            }
        } catch (err) {
            console.warn(`Failed to capture sample values for board ${boardId}:`, err);
            // Non-critical, continue without samples
        }

        return boardSchema;
    }

    /**
     * Fetch entire board as a tree structure.
     * For smaller boards or when you need the full tree.
     */
    async fetchBoard(boardId: string): Promise<MondayDataNode> {
        const schema = await this.discoverBoardSchema(boardId);

        const boardNode: MondayDataNode = {
            type: 'board',
            id: schema.boardId,
            name: schema.boardName,
            columnValues: [],
            children: [],
            metadata: {},
        };

        // Create group nodes
        const groupMap = new Map<string, MondayDataNode>();
        for (const group of schema.groups) {
            const groupNode: MondayDataNode = {
                type: 'group',
                id: group.id,
                name: group.title,
                columnValues: [],
                children: [],
                parent: boardNode,
                metadata: {
                    groupId: group.id,
                    groupTitle: group.title,
                },
            };
            groupMap.set(group.id, groupNode);
            boardNode.children.push(groupNode);
        }

        // Fetch all items with pagination
        let cursor: string | null = null;
        const pageSize = 100;

        do {
            const page = await this.fetchItemsPage(boardId, cursor, pageSize);
            cursor = page.cursor;

            for (const item of page.items) {
                const itemNode = this.createItemNode(item, schema.columns);

                // Find parent group
                const groupId = item.group?.id;
                const parentGroup = groupId ? groupMap.get(groupId) : null;

                if (parentGroup) {
                    itemNode.parent = parentGroup;
                    itemNode.metadata.groupId = groupId;
                    itemNode.metadata.groupTitle = item.group?.title;
                    parentGroup.children.push(itemNode);
                } else {
                    // Item without group - attach directly to board
                    itemNode.parent = boardNode;
                    boardNode.children.push(itemNode);
                }

                // Add subitems
                if (item.subitems) {
                    for (const subitem of item.subitems) {
                        const subitemNode = this.createItemNode(subitem, schema.columns, 'subitem');
                        subitemNode.parent = itemNode;
                        itemNode.children.push(subitemNode);
                    }
                }
            }
        } while (cursor);

        return boardNode;
    }

    /**
     * Stream items from a board using an async iterator.
     * Memory-efficient for large boards.
     */
    async *traverseHierarchy(
        boardId: string,
        config?: { includeSubitems?: boolean }
    ): AsyncGenerator<MondayDataNode> {
        const schema = await this.discoverBoardSchema(boardId);

        // Yield board node first
        yield {
            type: 'board',
            id: schema.boardId,
            name: schema.boardName,
            columnValues: [],
            children: [],
            metadata: {
                boardId: schema.boardId,
                boardName: schema.boardName,
            },
        };

        // Yield group nodes with boardId for multi-board disambiguation
        for (const group of schema.groups) {
            yield {
                type: 'group',
                id: group.id,
                name: group.title,
                columnValues: [],
                children: [],
                metadata: {
                    boardId: schema.boardId,
                    boardName: schema.boardName,
                    groupId: group.id,
                    groupTitle: group.title,
                },
            };
        }

        // Stream items with pagination
        let cursor: string | null = null;
        const pageSize = 100;

        do {
            const page = await this.fetchItemsPage(boardId, cursor, pageSize);
            cursor = page.cursor;

            for (const item of page.items) {
                const itemNode = this.createItemNode(item, schema.columns);
                // Add board context to all items for multi-board imports
                itemNode.metadata.boardId = schema.boardId;
                itemNode.metadata.boardName = schema.boardName;
                itemNode.metadata.groupId = item.group?.id;
                itemNode.metadata.groupTitle = item.group?.title;

                yield itemNode;

                // Yield subitems with parent reference and board context
                if (config?.includeSubitems !== false && item.subitems) {
                    for (const subitem of item.subitems) {
                        const subitemNode = this.createItemNode(subitem, schema.columns, 'subitem');
                        subitemNode.metadata.boardId = schema.boardId;
                        subitemNode.metadata.boardName = schema.boardName;
                        subitemNode.metadata.parentItemId = item.id;
                        yield subitemNode;
                    }
                }
            }
        } while (cursor);
    }

    // ============================================================================
    // MUTATIONS
    // ============================================================================

    /**
     * Create a webhook on a board.
     */
    async createWebhook(
        boardId: string,
        url: string,
        event: MondayWebhookEventType,
        config?: Record<string, unknown>
    ): Promise<number> {
        interface MutationResponse {
            create_webhook: {
                id: string;
                board_id: number;
            };
        }

        const response = await this.client.mutate<MutationResponse>(CREATE_WEBHOOK_MUTATION, {
            boardId: parseInt(boardId, 10),
            url,
            event,
            config,
        });

        if (!response.create_webhook?.id) {
            throw new Error('Failed to create webhook: No ID returned');
        }

        return parseInt(response.create_webhook.id, 10);
    }

    /**
     * Delete a webhook by ID.
     */
    async deleteWebhook(webhookId: number): Promise<void> {
        interface MutationResponse {
            delete_webhook: {
                id: string;
                board_id: number;
            };
        }

        await this.client.mutate<MutationResponse>(DELETE_WEBHOOK_MUTATION, {
            id: webhookId,
        });
    }

    // ============================================================================
    // PRIVATE HELPERS
    // ============================================================================

    private async fetchItemsPage(
        boardId: string,
        cursor: string | null,
        limit: number
    ): Promise<{
        cursor: string | null;
        items: Array<{
            id: string;
            name: string;
            group?: { id: string; title: string };
            created_at: string;
            updated_at: string;
            creator?: { id: string; name: string };
            state: string;
            column_values: Array<{
                id: string;
                text: string | null;
                value: string | null;
                type: string;
            }>;
            subitems?: Array<{
                id: string;
                name: string;
                created_at: string;
                updated_at: string;
                column_values: Array<{
                    id: string;
                    text: string | null;
                    value: string | null;
                    type: string;
                }>;
            }>;
        }>;
    }> {
        interface ItemsResponse {
            boards: Array<{
                items_page: {
                    cursor: string | null;
                    items: Array<{
                        id: string;
                        name: string;
                        group?: { id: string; title: string };
                        created_at: string;
                        updated_at: string;
                        creator?: { id: string; name: string };
                        state: string;
                        column_values: Array<{
                            id: string;
                            text: string | null;
                            value: string | null;
                            type: string;
                        }>;
                        subitems?: Array<{
                            id: string;
                            name: string;
                            created_at: string;
                            updated_at: string;
                            column_values: Array<{
                                id: string;
                                text: string | null;
                                value: string | null;
                                type: string;
                            }>;
                        }>;
                    }>;
                };
            }>;
        }

        const data = await this.client.query<ItemsResponse>(BOARD_ITEMS_QUERY, {
            boardId,
            cursor,
            limit,
        });

        return data.boards[0]?.items_page ?? { cursor: null, items: [] };
    }

    private createItemNode(
        item: {
            id: string;
            name: string;
            created_at?: string;
            updated_at?: string;
            creator?: { id: string; name: string };
            state?: string;
            column_values: Array<{
                id: string;
                text: string | null;
                value: string | null;
                type: string;
            }>;
        },
        columnSchema: MondayColumnSchema[],
        type: 'item' | 'subitem' = 'item'
    ): MondayDataNode {
        // Map column values with titles from schema
        const columnMap = new Map(columnSchema.map((c) => [c.id, c]));

        const columnValues: MondayColumnValue[] = item.column_values.map((cv) => {
            const schema = columnMap.get(cv.id);
            return {
                id: cv.id,
                title: schema?.title ?? cv.id,
                type: cv.type || schema?.type || 'unknown',
                text: cv.text,
                value: cv.value ? JSON.parse(cv.value) : null,
            };
        });

        return {
            type,
            id: item.id,
            name: item.name,
            columnValues,
            children: [],
            metadata: {
                creator: item.creator,
                createdAt: item.created_at,
                updatedAt: item.updated_at,
                state: item.state as 'active' | 'archived' | 'deleted' | undefined,
            },
        };
    }
}

export default MondayConnector;
