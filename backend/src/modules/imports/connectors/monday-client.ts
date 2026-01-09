/**
 * Monday.com GraphQL Client
 *
 * Wrapper around @mondaydotcomorg/api SDK for Monday.com API access.
 * Provides consistent error handling and configuration.
 */

import { ApiClient } from '@mondaydotcomorg/api';

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
 * Uses the official @mondaydotcomorg/api SDK
 */
export class MondayClient {
    private client: ApiClient;

    constructor(config: MondayClientConfig) {
        this.client = new ApiClient({
            token: config.token,
            requestConfig: {
                errorPolicy: 'all', // Return partial data even with errors
            },
        });
    }

    /**
     * Execute a GraphQL query against the Monday.com API
     */
    async query<T>(
        query: string,
        variables?: Record<string, unknown>
    ): Promise<T> {
        try {
            const result = await this.client.request<T>(query, variables as any);
            return result;
        } catch (err) {
            // Handle SDK errors - extract message and wrap in our error type
            const error = err as Error & { response?: { errors?: Array<{ message: string; locations?: any; extensions?: any }>; status?: number } };
            if (error.response?.errors) {
                const errors = error.response.errors.map((e) => ({
                    message: e.message,
                    locations: e.locations,
                    extensions: e.extensions,
                }));
                throw new MondayClientError(
                    errors.map((e) => e.message).join('; ') ?? 'Unknown Monday API error',
                    errors,
                    error.response.status
                );
            }
            throw new MondayClientError(
                error.message || 'Unknown Monday API error',
                undefined,
                undefined
            );
        }
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

    /**
     * Get the underlying ApiClient for direct operations access
     */
    getOperations() {
        return this.client.operations;
    }
}

export default MondayClient;
