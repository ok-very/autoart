import { useState, useMemo, useEffect, useRef } from 'react';

import type { FieldDescriptor } from '@autoart/shared';

import { useRecordDefinitions } from '../../api/hooks';
import { generateFieldIndex } from '../../utils/fieldIndexBuilder';
import { MillerColumn, type MillerColumnItem } from '../../ui/molecules/MillerColumn';

export interface FieldsMillerColumnsViewProps {
    className?: string;
    onSelectField?: (field: FieldDescriptor) => void;
    onCheckChange?: (checkedIds: Set<string>) => void;
}

export function FieldsMillerColumnsView({
    className,
    onSelectField,
    onCheckChange
}: FieldsMillerColumnsViewProps) {
    const { data: definitions, isLoading } = useRecordDefinitions();

    // State for navigation (active path) - simplified: Definition -> Fields
    const [activeDefinitionId, setActiveDefinitionId] = useState<string | null>(null);
    const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

    // State for checkboxes (inclusive filtering)
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

    const containerRef = useRef<HTMLDivElement>(null);

    // Generate Index (now returns definitions directly as categories)
    const fieldIndex = useMemo(() => {
        if (!definitions) return null;
        return generateFieldIndex(definitions);
    }, [definitions]);

    // Auto-scroll when columns open
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTo({
                left: containerRef.current.scrollWidth,
                behavior: 'smooth',
            });
        }
    }, [activeDefinitionId]);

    // Derived Columns Data - Definitions are now the first column
    const definitionItems: MillerColumnItem[] = useMemo(() => {
        if (!fieldIndex) return [];
        return fieldIndex.categories.map(def => ({
            id: def.id,
            label: def.label,
            hasChildren: (def.fields?.length || 0) > 0,
            badge: { text: String(def.childCount), color: 'bg-slate-100 text-slate-500' },
            data: def
        }));
    }, [fieldIndex]);

    const fieldItems: MillerColumnItem[] = useMemo(() => {
        if (!fieldIndex || !activeDefinitionId) return [];
        const definition = fieldIndex.categories.find(d => d.id === activeDefinitionId);
        if (!definition || !definition.fields) return [];

        return definition.fields.map(field => ({
            id: field.id,
            label: field.label,
            sublabel: field.type,
            hasChildren: false,
            data: field
        }));
    }, [fieldIndex, activeDefinitionId]);

    // Handlers
    const handleDefinitionSelect = (item: MillerColumnItem) => {
        setActiveDefinitionId(item.id);
        setActiveFieldId(null);
    };

    const handleFieldSelect = (item: MillerColumnItem) => {
        setActiveFieldId(item.id);
        if (onSelectField) {
            onSelectField(item.data as FieldDescriptor);
        }
    };

    const handleCheck = (item: MillerColumnItem, checked: boolean) => {
        const newChecked = new Set(checkedIds);

        if (checked) {
            newChecked.add(item.id);
        } else {
            newChecked.delete(item.id);
        }

        setCheckedIds(newChecked);
        if (onCheckChange) {
            onCheckChange(newChecked);
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 text-slate-400 bg-slate-100">
                <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-blue-500 rounded-full" />
                    <span>Loading field definitions...</span>
                </div>
            </div>
        );
    }

    if (!definitions || definitions.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 text-slate-400 bg-slate-100">
                <div className="text-center">
                    <p>No field definitions found.</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`flex flex-1 overflow-hidden bg-slate-100 border-r border-slate-200 ${className || ''}`}
            data-aa-component="FieldsMillerColumnsView"
        >
            <div
                ref={containerRef}
                className="flex flex-1 overflow-x-auto custom-scroll"
            >
                {/* 1. Definitions (now the first column) */}
                <MillerColumn
                    title="Definitions"
                    items={definitionItems}
                    selectedId={activeDefinitionId}
                    checkedIds={checkedIds}
                    onSelect={handleDefinitionSelect}
                    onCheck={handleCheck}
                    enableSearch
                />

                {/* 2. Fields */}
                {activeDefinitionId && (
                    <MillerColumn
                        title="Fields"
                        items={fieldItems}
                        selectedId={activeFieldId}
                        checkedIds={checkedIds}
                        onSelect={handleFieldSelect}
                        onCheck={handleCheck}
                        enableSearch
                    />
                )}
            </div>
        </div>
    );
}

