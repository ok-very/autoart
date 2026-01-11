import { useState, useMemo, useEffect, useRef } from 'react';
import { useRecordDefinitions } from '../../api/hooks';
import { generateFieldIndex } from '../../utils/fieldIndexBuilder';
import { MillerColumn, type MillerColumnItem } from '../molecules/MillerColumn';
import type { FieldDescriptor } from '@autoart/shared';

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
    
    // State for navigation (active path)
    const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
    const [activeDefinitionId, setActiveDefinitionId] = useState<string | null>(null);
    const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

    // State for checkboxes (inclusive filtering)
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

    const containerRef = useRef<HTMLDivElement>(null);

    // Generate Index
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
    }, [activeCategoryId, activeDefinitionId]);

    // Derived Columns Data
    const categoryItems: MillerColumnItem[] = useMemo(() => {
        if (!fieldIndex) return [];
        return fieldIndex.categories.map(cat => ({
            id: cat.id,
            label: cat.label,
            hasChildren: (cat.subcategories?.length || 0) > 0,
            badge: { text: String(cat.childCount), color: 'bg-slate-100 text-slate-500' },
            data: cat
        }));
    }, [fieldIndex]);

    const definitionItems: MillerColumnItem[] = useMemo(() => {
        if (!fieldIndex || !activeCategoryId) return [];
        const category = fieldIndex.categories.find(c => c.id === activeCategoryId);
        if (!category || !category.subcategories) return [];

        return category.subcategories.map(sub => ({
            id: sub.id,
            label: sub.label,
            hasChildren: (sub.fields?.length || 0) > 0,
            badge: { text: String(sub.childCount), color: 'bg-slate-100 text-slate-500' },
            data: sub
        }));
    }, [fieldIndex, activeCategoryId]);

    const fieldItems: MillerColumnItem[] = useMemo(() => {
        if (!fieldIndex || !activeCategoryId || !activeDefinitionId) return [];
        const category = fieldIndex.categories.find(c => c.id === activeCategoryId);
        const definition = category?.subcategories?.find(d => d.id === activeDefinitionId);
        if (!definition || !definition.fields) return [];

        return definition.fields.map(field => ({
            id: field.id,
            label: field.label,
            sublabel: field.type,
            hasChildren: false,
            data: field
        }));
    }, [fieldIndex, activeCategoryId, activeDefinitionId]);

    // Handlers
    const handleCategorySelect = (item: MillerColumnItem) => {
        setActiveCategoryId(item.id);
        setActiveDefinitionId(null);
        setActiveFieldId(null);
    };

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
        
        // Recursive check logic could go here (if checking a category checks all children)
        // For now, simple toggle
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
                {/* 1. Categories */}
                <MillerColumn
                    title="Categories"
                    items={categoryItems}
                    selectedId={activeCategoryId}
                    checkedIds={checkedIds}
                    onSelect={handleCategorySelect}
                    onCheck={handleCheck}
                />

                {/* 2. Definitions */}
                {activeCategoryId && (
                    <MillerColumn
                        title="Definitions"
                        items={definitionItems}
                        selectedId={activeDefinitionId}
                        checkedIds={checkedIds}
                        onSelect={handleDefinitionSelect}
                        onCheck={handleCheck}
                        enableSearch
                    />
                )}

                {/* 3. Fields */}
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
