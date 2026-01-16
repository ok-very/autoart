import { MondayColumnSemanticRole } from '../../../../../api/types/monday';

// Role metadata with descriptions and preferred types
export const ROLE_METADATA: Record<MondayColumnSemanticRole, {
    label: string;
    description: string;
    preferredTypes: string[];
    category: 'core' | 'data' | 'template' | 'link' | 'other';
}> = {
    title: {
        label: 'Title',
        description: 'Main item name shown on cards and lists',
        preferredTypes: ['name', 'text'],
        category: 'core',
    },
    description: {
        label: 'Description',
        description: 'Long-form details shown in item panel',
        preferredTypes: ['text', 'long_text'],
        category: 'core',
    },
    status: {
        label: 'Status',
        description: 'Powers status pills, filters, and dashboards',
        preferredTypes: ['status', 'color'],
        category: 'core',
    },
    due_date: {
        label: 'Due Date',
        description: 'Enables overdue highlighting and date filters',
        preferredTypes: ['date', 'timeline'],
        category: 'core',
    },
    assignee: {
        label: 'Assignee',
        description: 'Person responsible, used in workload views',
        preferredTypes: ['people', 'person'],
        category: 'core',
    },
    priority: {
        label: 'Priority',
        description: 'Priority level for sorting and filtering',
        preferredTypes: ['status', 'dropdown'],
        category: 'core',
    },
    tags: {
        label: 'Tags',
        description: 'Labels for grouping and filtering',
        preferredTypes: ['tags', 'dropdown'],
        category: 'core',
    },
    estimate: {
        label: 'Estimate',
        description: 'Effort/time estimate for planning',
        preferredTypes: ['numbers', 'hour'],
        category: 'core',
    },
    identifier: {
        label: 'Identifier',
        description: 'External ID or reference number',
        preferredTypes: ['text', 'numbers'],
        category: 'core',
    },
    fact: {
        label: 'Fact',
        description: 'Structured data for analytics (requires fact kind)',
        preferredTypes: ['text', 'numbers', 'dropdown'],
        category: 'data',
    },
    note: {
        label: 'Note',
        description: 'Free-form note attached to item',
        preferredTypes: ['text', 'long_text'],
        category: 'data',
    },
    metric: {
        label: 'Metric',
        description: 'Numeric data for charts and reports',
        preferredTypes: ['numbers', 'formula'],
        category: 'data',
    },
    template_name: {
        label: 'Template Name',
        description: 'Name of a template to create/link',
        preferredTypes: ['text', 'name'],
        category: 'template',
    },
    template_key: {
        label: 'Template Key',
        description: 'Unique key for template matching',
        preferredTypes: ['text'],
        category: 'template',
    },
    link_to_template: {
        label: 'Link to Template',
        description: 'Creates relationship to a template',
        preferredTypes: ['board_relation', 'mirror', 'connect_boards'],
        category: 'link',
    },
    link_to_project: {
        label: 'Link to Project',
        description: 'Creates relationship to a project',
        preferredTypes: ['board_relation', 'mirror', 'connect_boards'],
        category: 'link',
    },
    link_to_subprocess: {
        label: 'Link to Subprocess',
        description: 'Creates relationship to a subprocess',
        preferredTypes: ['board_relation', 'mirror', 'connect_boards'],
        category: 'link',
    },
    link_to_action: {
        label: 'Link to Action',
        description: 'Creates relationship to another action',
        preferredTypes: ['dependency', 'board_relation', 'mirror', 'connect_boards'],
        category: 'link',
    },
    link_to_record: {
        label: 'Link to Record',
        description: 'Creates relationship to a record',
        preferredTypes: ['board_relation', 'mirror', 'connect_boards'],
        category: 'link',
    },
    dependency: {
        label: 'Dependency',
        description: 'Creates dependency link to same entity type',
        preferredTypes: ['dependency', 'board_relation'],
        category: 'link',
    },
    custom: {
        label: 'Custom',
        description: 'Stored as custom field, not used by core UI',
        preferredTypes: [],
        category: 'other',
    },
    ignore: {
        label: 'Ignore',
        description: 'Column will not be imported',
        preferredTypes: [],
        category: 'other',
    },
};

export const SEMANTIC_ROLE_OPTIONS = Object.entries(ROLE_METADATA).map(([value, meta]) => ({
    value: value as MondayColumnSemanticRole,
    label: meta.label,
}));
