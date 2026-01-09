/**
 * Monday.com GraphQL Client
 *
 * Low-level wrapper for Monday.com GraphQL API.
 * Handles authentication, request formatting, and error handling.
 */

const MONDAY_API_URL = 'https://api.monday.com/v2';

export interface MondayClientConfig {
    token: string;
    apiVersion?: string;
}

export interface MondayGraphQLResponse<T> {
    data?: T;
    errors?: Array<{
        message: string;
        locations?: Array<{ line: number; column: number }>;
        extensions?: Record<string, unknown>;
    }>;
    account_id?: number;
}

export class MondayClientError extends Error {
    constructor(
        message: string,
        public readonly errors?: MondayGraphQLResponse<unknown>['errors'],
        public readonly statusCode?: number
    ) {
        super(message);
        this.name = 'MondayClientError';
    }
}

/**
 * Monday.com GraphQL API Client
 */
export class MondayClient {
    private token: string;
    private apiVersion: string;

    constructor(config: MondayClientConfig) {
        this.token = config.token;
        this.apiVersion = config.apiVersion ?? '2024-10';
    }

    /**
     * Execute a GraphQL query against the Monday.com API
     */
    async query<T>(
        query: string,
        variables?: Record<string, unknown>
    ): Promise<T> {
        const response = await fetch(MONDAY_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.token,
                'API-Version': this.apiVersion,
            },
            body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
            throw new MondayClientError(
                `Monday API request failed: ${response.status} ${response.statusText}`,
                undefined,
                response.status
            );
        }

        const json: unknown = await response.json();
        const result = json as MondayGraphQLResponse<T>;

        if (result.errors && result.errors.length > 0) {
            throw new MondayClientError(
                result.errors.map((e) => e.message).join('; '),
                result.errors
            );
        }

        if (!result.data) {
            throw new MondayClientError('No data returned from Monday API');
        }

        return result.data;
    }

    /**
     * Execute a mutation against the Monday.com API
     */
    async mutate<T>(
        mutation: string,
        variables?: Record<string, unknown>
    ): Promise<T> {
        return this.query<T>(mutation, variables);
    }
}

export default MondayClient;
