import { useState, useEffect } from 'react';
import { Save, AlertTriangle, Plus, X } from 'lucide-react';
import { useRecordDefinition, useUpdateDefinition } from '../../api/hooks';
import type { FieldDescriptor, FieldDef, StatusConfig } from '@autoart/shared';

// Available colors for status options
const STATUS_COLORS = [
    'slate', 'gray', 'zinc', 'neutral', 'stone',
    'red', 'orange', 'amber', 'yellow', 'lime',
    'green', 'emerald', 'teal', 'cyan', 'sky',
    'blue', 'indigo', 'violet', 'purple', 'fuchsia',
    'pink', 'rose'
];

interface FieldDefinitionEditorProps {
    field: FieldDescriptor;
}

export function FieldDefinitionEditor({ field }: FieldDefinitionEditorProps) {
    const definitionId = field.sourceDefinitionId || '';
    const { data: definition, isLoading } = useRecordDefinition(definitionId);
    const { mutate: updateDefinition, isPending: isSaving } = useUpdateDefinition();

    // Form State
    const [label, setLabel] = useState('');
    const [required, setRequired] = useState(false);
    const [options, setOptions] = useState<string[]>([]);
    const [statusConfig, setStatusConfig] = useState<StatusConfig>({});
    
    // UI State
    const [optionInput, setOptionInput] = useState('');

    // Initialize form when definition loads
    useEffect(() => {
        if (definition) {
            const fieldDef = definition.schema_config.fields.find(f => f.key === field.fieldKey);
            if (fieldDef) {
                setLabel(fieldDef.label);
                setRequired(!!fieldDef.required);
                setOptions(fieldDef.options || []);
                setStatusConfig(fieldDef.statusConfig || {});
            }
        }
    }, [definition, field.fieldKey]);

    const handleSave = () => {
        if (!definition) return;

        const updatedFields = definition.schema_config.fields.map(f => {
            if (f.key === field.fieldKey) {
                const updatedField: FieldDef = {
                    ...f,
                    label,
                    required,
                };

                if (f.type === 'select' || f.type === 'status') {
                    updatedField.options = options;
                }

                if (f.type === 'status') {
                    updatedField.statusConfig = statusConfig;
                }
                
                return updatedField;
            }
            return f;
        });

        updateDefinition({
            id: definitionId,
            schemaConfig: {
                fields: updatedFields
            }
        });
    };

    const addOption = () => {
        if (!optionInput.trim()) return;
        const val = optionInput.trim();
        if (!options.includes(val)) {
            const newOptions = [...options, val];
            setOptions(newOptions);
            
            // For status, also add default config
            if (field.type === 'status') {
                setStatusConfig(prev => ({
                    ...prev,
                    [val]: { label: val, colorClass: 'bg-slate-100 text-slate-800' }
                }));
            }
        }
        setOptionInput('');
    };

    const removeOption = (opt: string) => {
        setOptions(options.filter(o => o !== opt));
        if (field.type === 'status') {
            const newConfig = { ...statusConfig };
            delete newConfig[opt];
            setStatusConfig(newConfig);
        }
    };

    const updateStatusColor = (opt: string, color: string) => {
        setStatusConfig(prev => ({
            ...prev,
            [opt]: { 
                ...prev[opt], 
                colorClass: `bg-${color}-100 text-${color}-800` 
            }
        }));
    };

    if (isLoading) return <div className="p-8 text-center text-slate-400">Loading definition...</div>;
    if (!definition) return <div className="p-8 text-center text-red-400">Definition not found</div>;

    const fieldDef = definition.schema_config.fields.find(f => f.key === field.fieldKey);
    if (!fieldDef) return <div className="p-8 text-center text-red-400">Field definition not found</div>;

    const isSystem = definition.is_system;

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="h-14 px-6 border-b border-slate-200 flex items-center justify-between bg-white">
                <div>
                    <h2 className="text-lg font-semibold text-slate-800">{label || field.label}</h2>
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                        <span>{definition.name}</span>
                        <span>•</span>
                        <span className="font-mono">{field.fieldKey}</span>
                        <span>•</span>
                        <span className="uppercase">{field.type}</span>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving || isSystem}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    <Save size={16} />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            {isSystem && (
                <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-amber-800 text-sm">
                    <AlertTriangle size={16} />
                    This is a system field. Some properties cannot be edited.
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-2xl space-y-8">
                    
                    {/* Basic Properties */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100">
                            General Properties
                        </h3>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Display Label
                            </label>
                            <input
                                type="text"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                disabled={isSystem}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="required-check"
                                checked={required}
                                onChange={(e) => setRequired(e.target.checked)}
                                disabled={isSystem}
                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="required-check" className="text-sm text-slate-700">
                                Required Field
                            </label>
                        </div>
                    </div>

                    {/* Options Editor (Select / Status) */}
                    {(field.type === 'select' || field.type === 'status') && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100">
                                {field.type === 'status' ? 'Status Configuration' : 'Options'}
                            </h3>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={optionInput}
                                    onChange={(e) => setOptionInput(e.target.value)}
                                    placeholder="Add new option..."
                                    className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
                                />
                                <button
                                    onClick={addOption}
                                    type="button"
                                    className="px-3 py-2 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>

                            <div className="space-y-2">
                                {options.map(opt => (
                                    <div key={opt} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="flex-1 font-medium text-slate-700">{opt}</div>
                                        
                                        {field.type === 'status' && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-400">Color:</span>
                                                <select
                                                    value={statusConfig[opt]?.colorClass?.split('-')[1] || 'slate'}
                                                    onChange={(e) => updateStatusColor(opt, e.target.value)}
                                                    className="text-xs border-none bg-transparent focus:ring-0 cursor-pointer"
                                                >
                                                    {STATUS_COLORS.map(color => (
                                                        <option key={color} value={color}>{color}</option>
                                                    ))}
                                                </select>
                                                {/* Preview */}
                                                <div className={`w-4 h-4 rounded ${statusConfig[opt]?.colorClass || 'bg-slate-100'}`} />
                                            </div>
                                        )}

                                        <button
                                            onClick={() => removeOption(opt)}
                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                                {options.length === 0 && (
                                    <div className="text-sm text-slate-400 italic text-center py-4">
                                        No options defined
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
