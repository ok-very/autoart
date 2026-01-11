/**
 * Domain Hooks - Bridge between API data and domain layer
 * 
 * These hooks fetch data and transform it using domain factories.
 * Composites should use these hooks instead of raw API hooks + manual transforms.
 * 
 * NOTE: Full domain integration requires ProjectState construction.
 * This is a simplified bridge for record-level view model building.
 */

import { useMemo } from 'react';

import {
    buildFieldViewModel,
    type BuildFieldViewModelOptions,
    type FieldViewModel,
    type FieldDefinition,
    type ProjectState,
    type EntityContext,
} from '@autoart/shared/domain';

import { useRecordDefinition, useRecord } from '../../../api/hooks';

/**
 * Create a minimal ProjectState for record-level operations.
 * 
 * Full project context would come from a project-level hook.
 * This is a placeholder for single-record operations.
 */
function createMinimalProjectState(phase: number = 0): ProjectState {
    return {
        projectId: '',
        phase,
        nodes: [],
        records: [],
        definitions: [],
        metadata: {},
    };
}

/**
 * Map API field definition to domain FieldDefinition
 */
function mapToFieldDefinition(fieldDef: {
    key: string;
    label: string;
    type: string;
    required?: boolean;
    options?: string[];
}): FieldDefinition {
    return {
        key: fieldDef.key,
        label: fieldDef.label,
        type: fieldDef.type as FieldDefinition['type'],
        required: fieldDef.required,
        options: fieldDef.options,
        // Phase defaults to 0 (always visible) for basic records
        phase: 0,
    };
}

/**
 * Hook to get field view models for a record
 * 
 * Fetches record and definition, then builds view models using domain layer.
 */
export function useRecordFieldViewModels(recordId: string | null) {
    const { data: record, isLoading: recordLoading } = useRecord(recordId);
    const { data: definition, isLoading: defLoading } = useRecordDefinition(
        record?.definition_id ?? null
    );

    const viewModels = useMemo(() => {
        if (!record || !definition) return [];

        const projectState = createMinimalProjectState();
        const entityContext: EntityContext = {
            entityId: record.id,
            entityType: 'record',
            definitionId: record.definition_id,
        };

        // Map API fields to domain format
        const fields: FieldDefinition[] = (definition.schema_config?.fields || []).map(mapToFieldDefinition);
        const values: Record<string, unknown> = record.data || {};

        // Build view models for each field
        return fields.map((field): FieldViewModel => {
            const options: BuildFieldViewModelOptions = {
                field,
                value: values[field.key],
                projectState,
                entityContext,
            };
            return buildFieldViewModel(options);
        });
    }, [record, definition]);

    const visibleViewModels = useMemo(() => {
        return viewModels.filter((vm) => vm.visible);
    }, [viewModels]);

    return {
        viewModels,
        visibleViewModels,
        record,
        definition,
        isLoading: recordLoading || defLoading,
    };
}

export type { FieldViewModel };
