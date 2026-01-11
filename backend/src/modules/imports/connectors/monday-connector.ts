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

        return {
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
                sampleValues: [], // Populated during traversal
            })),
        };
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
            metadata: {},
        };

        // Yield group nodes
        for (const group of schema.groups) {
            yield {
                type: 'group',
                id: group.id,
                name: group.title,
                columnValues: [],
                children: [],
                metadata: {
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
                itemNode.metadata.groupId = item.group?.id;
                itemNode.metadata.groupTitle = item.group?.title;

                yield itemNode;

                // Yield subitems with parent reference
                if (config?.includeSubitems !== false && item.subitems) {
                    for (const subitem of item.subitems) {
                        const subitemNode = this.createItemNode(subitem, schema.columns, 'subitem');
                        subitemNode.metadata.parentItemId = item.id;
                        yield subitemNode;
                    }
                }
            }
        } while (cursor);
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
