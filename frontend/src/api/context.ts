/**
 * UI Context for API Traceability
 *
 * Provides context about which UI component triggered an API request.
 * This is purely diagnostic - missing context must NOT block requests.
 *
 * @module api/context
 */

export interface UIContext {
    /** The component that triggered the request */
    component?: string;
    /** The action being performed */
    action?: string;
    /** The specific element ID that triggered the action */
    elementId?: string;
    /** The current view/page */
    view?: string;
    /** Timestamp when the action was triggered */
    timestamp: number;
}

// Current context - set before making API calls
let currentContext: Partial<UIContext> = {};

/**
 * Set the current UI context for API requests.
 * Call this before making API calls to attach context.
 *
 * @example
 * setUIContext({ component: 'RecordInspector', action: 'update' });
 * await api.patch('/records/123', data);
 */
export function setUIContext(context: Partial<Omit<UIContext, 'timestamp'>>): void {
    currentContext = { ...context };
}

/**
 * Clear the current UI context.
 * Call after API calls complete if needed.
 */
export function clearUIContext(): void {
    currentContext = {};
}

/**
 * Get the current UI context with timestamp.
 * Used by the API client to attach headers.
 */
export function getUIContext(): UIContext | null {
    if (Object.keys(currentContext).length === 0) {
        return null;
    }
    return {
        ...currentContext,
        timestamp: Date.now(),
    };
}

/**
 * Get the UI context header value for API requests.
 * Returns null if no context is set.
 */
export function getUIContextHeader(): string | null {
    const context = getUIContext();
    if (!context) return null;
    try {
        return JSON.stringify(context);
    } catch {
        return null;
    }
}

/**
 * Create a context setter for a specific component.
 * Useful for hooks or component-level context.
 *
 * @example
 * const setContext = createComponentContext('RecordInspector');
 * setContext('update', 'save-button');
 */
export function createComponentContext(component: string) {
    return (action?: string, elementId?: string, view?: string) => {
        setUIContext({ component, action, elementId, view });
    };
}

/**
 * HOC-style wrapper to set context before an async function.
 *
 * @example
 * const saveWithContext = withUIContext(
 *   { component: 'RecordInspector', action: 'save' },
 *   async () => await api.patch('/records/123', data)
 * );
 */
export function withUIContext<T>(
    context: Partial<Omit<UIContext, 'timestamp'>>,
    fn: () => Promise<T>
): Promise<T> {
    setUIContext(context);
    return fn().finally(() => clearUIContext());
}

/**
 * Header name for UI context.
 * Using x- prefix for custom headers.
 */
export const UI_CONTEXT_HEADER = 'x-ui-context';
