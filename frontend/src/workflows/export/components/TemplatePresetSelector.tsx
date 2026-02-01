/**
 * Template Preset Selector
 * 
 * Dropdown for selecting export template format.
 * Supports built-in presets and custom templates.
 */

import { CaretDown, FileText, Table, GoogleLogo, Gear } from '@phosphor-icons/react';
import type { TemplatePreset } from '../../../stores';

import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from '@autoart/ui';

// ---------------------------------------------------------------------------
// Preset Configuration
// ---------------------------------------------------------------------------

interface PresetConfig {
    label: string;
    description: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
}

const PRESET_CONFIGS: Record<TemplatePreset, PresetConfig> = {
    bfa_rtf: {
        label: 'BFA Document',
        description: 'Rich text format for BFA To-Do',
        icon: FileText,
    },
    csv: {
        label: 'CSV Export',
        description: 'Comma-separated values spreadsheet',
        icon: Table,
    },
    google_docs: {
        label: 'Google Docs',
        description: 'Structured document for Google',
        icon: GoogleLogo,
    },
    custom: {
        label: 'Custom Template',
        description: 'User-defined export format',
        icon: Gear,
    },
};

const PRESET_ORDER: TemplatePreset[] = ['bfa_rtf', 'csv', 'google_docs', 'custom'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TemplatePresetSelectorProps {
    value: TemplatePreset;
    onChange: (preset: TemplatePreset) => void;
    disabled?: boolean;
}

export function TemplatePresetSelector({ value, onChange, disabled = false }: TemplatePresetSelectorProps) {
    const currentConfig = PRESET_CONFIGS[value];
    const CurrentIcon = currentConfig.icon;

    return (
        <Dropdown>
            <DropdownTrigger asChild disabled={disabled}>
                <button
                    type="button"
                    className={`
            flex items-center gap-2 px-3 py-2 rounded-lg border
            ${disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-slate-50 border-slate-200'}
            transition-colors min-w-[180px]
          `}
                >
                    <CurrentIcon size={16} className="text-slate-600" />
                    <span className="flex-1 text-left text-sm font-medium">{currentConfig.label}</span>
                    <CaretDown size={14} className="text-slate-400" />
                </button>
            </DropdownTrigger>

            <DropdownContent className="min-w-[220px]" sideOffset={4}>
                {PRESET_ORDER.map((preset) => {
                    const config = PRESET_CONFIGS[preset];
                    const Icon = config.icon;
                    const isSelected = preset === value;

                    return (
                        <DropdownItem
                            key={preset}
                            className={`
                  flex items-start gap-3 px-3 py-2 rounded-md cursor-pointer
                  ${isSelected ? 'bg-emerald-50' : ''}
                `}
                            onSelect={() => onChange(preset)}
                        >
                            <Icon size={18} className={isSelected ? 'text-emerald-600' : 'text-slate-500'} />
                            <div className="flex-1">
                                <div className={`text-sm font-medium ${isSelected ? 'text-emerald-700' : 'text-slate-900'}`}>
                                    {config.label}
                                </div>
                                <div className="text-xs text-slate-500">{config.description}</div>
                            </div>
                            {isSelected && (
                                <div className="text-emerald-600 text-xs font-medium self-center">✓</div>
                            )}
                        </DropdownItem>
                    );
                })}
            </DropdownContent>
        </Dropdown>
    );
}
