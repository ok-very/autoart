/**
 * NamingConfigPanel
 *
 * Collapsible panel for configuring artifact naming patterns.
 * Shows template preview and allows customization of:
 * - Filename template with {var} placeholders
 * - Index start and padding
 * - Prefix/suffix
 * - Numbering mode
 */

import { useState, useMemo } from 'react';
import { Stack, Text, Inline, Button } from '@autoart/ui';
import { ChevronDown, ChevronRight, Settings } from 'lucide-react';
import clsx from 'clsx';

import { DEFAULT_NAMING_CONFIG } from '../types';
import type { NamingConfig, NumberingMode, CollisionMode } from '../types';

interface NamingConfigPanelProps {
  config: NamingConfig;
  onChange: (updates: Partial<NamingConfig>) => void;
  /** Whether to start collapsed (default: true) */
  defaultCollapsed?: boolean;
}

/** Available template variables with descriptions */
const TEMPLATE_VARIABLES = [
  { var: 'index', description: 'Sequential number (padded)' },
  { var: 'hash', description: 'Content/URL hash (8 chars)' },
  { var: 'date', description: 'Collection date' },
  { var: 'artist', description: 'Artist name from page' },
  { var: 'title', description: 'Artwork title' },
  { var: 'source', description: 'Source hostname/folder' },
];

/** Generate preview filename from template */
function generatePreview(config: NamingConfig): string {
  let preview = config.template;

  // Replace template variables with example values
  const exampleValues: Record<string, string> = {
    index: String(config.indexStart).padStart(config.indexPadding, '0'),
    hash: 'a1b2c3d4',
    date: '20260124',
    artist: 'jane-doe',
    title: 'untitled-1',
    source: 'gallery-com',
  };

  for (const [varName, value] of Object.entries(exampleValues)) {
    preview = preview.replace(new RegExp(`\\{${varName}\\}`, 'g'), value);
  }

  // Apply prefix/suffix
  if (config.prefix) {
    preview = `${config.prefix}${preview}`;
  }
  if (config.suffix) {
    preview = `${preview}${config.suffix}`;
  }

  return `${preview}.jpg`;
}

export function NamingConfigPanel({
  config,
  onChange,
  defaultCollapsed = true,
}: NamingConfigPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const preview = useMemo(() => generatePreview(config), [config]);

  return (
    <div className="border border-ws-panel-border rounded-lg overflow-hidden">
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={clsx(
          'w-full px-4 py-3 flex items-center justify-between',
          'bg-ws-bg hover:bg-slate-100 transition-colors',
          'text-left'
        )}
      >
        <Inline gap="sm" align="center">
          <Settings className="w-4 h-4 text-ws-text-secondary" />
          <Text weight="medium" size="sm">
            Advanced Naming Settings
          </Text>
        </Inline>
        <Inline gap="sm" align="center">
          <Text size="xs" color="muted" className="font-mono">
            {preview}
          </Text>
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-ws-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-ws-muted" />
          )}
        </Inline>
      </button>

      {/* Collapsible content */}
      {!isCollapsed && (
        <div className="px-4 py-4 bg-ws-panel-bg border-t border-ws-panel-border">
          <Stack gap="md">
            {/* Template input */}
            <div>
              <label className="block text-sm font-medium text-ws-text-secondary mb-1">
                Filename Template
              </label>
              <input
                type="text"
                value={config.template}
                onChange={(e) => onChange({ template: e.target.value })}
                placeholder="{index}_{hash}"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              />
              <div className="mt-2 flex flex-wrap gap-1">
                {TEMPLATE_VARIABLES.map(({ var: v, description }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onChange({ template: `${config.template}{${v}}` })}
                    className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded border border-ws-panel-border transition-colors"
                    title={description}
                  >
                    {`{${v}}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Index settings row */}
            <Inline gap="md">
              <div className="flex-1">
                <label className="block text-sm font-medium text-ws-text-secondary mb-1">
                  Start Index
                </label>
                <input
                  type="number"
                  min={0}
                  value={config.indexStart}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value);
                    // Clamp to minimum of 0 to prevent negative indices; default to 0 when empty/invalid
                    onChange({ indexStart: Number.isNaN(parsed) ? 0 : Math.max(0, parsed) });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-ws-text-secondary mb-1">
                  Padding Width
                </label>
                <select
                  value={config.indexPadding}
                  onChange={(e) => onChange({ indexPadding: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={2}>2 (01, 02...)</option>
                  <option value={3}>3 (001, 002...)</option>
                  <option value={4}>4 (0001, 0002...)</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-ws-text-secondary mb-1">
                  Numbering Mode
                </label>
                <select
                  value={config.numberingMode}
                  onChange={(e) => onChange({ numberingMode: e.target.value as NumberingMode })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="sequential">Sequential (global)</option>
                  <option value="by_source">Per Source</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-ws-text-secondary mb-1">
                  On Name Collision
                </label>
                <select
                  value={config.collisionMode}
                  onChange={(e) => onChange({ collisionMode: e.target.value as CollisionMode })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="suffix">Add suffix (_1, _2, ...)</option>
                  <option value="replace">Replace existing</option>
                </select>
              </div>
            </Inline>

            {/* Prefix/Suffix row */}
            <Inline gap="md">
              <div className="flex-1">
                <label className="block text-sm font-medium text-ws-text-secondary mb-1">
                  Prefix
                </label>
                <input
                  type="text"
                  value={config.prefix}
                  onChange={(e) => onChange({ prefix: e.target.value })}
                  placeholder="e.g., artist_"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-ws-text-secondary mb-1">
                  Suffix
                </label>
                <input
                  type="text"
                  value={config.suffix}
                  onChange={(e) => onChange({ suffix: e.target.value })}
                  placeholder="e.g., _final"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </Inline>

            {/* Preview */}
            <div className="p-3 bg-ws-bg rounded-lg">
              <Text size="xs" color="muted" className="mb-1">
                Preview:
              </Text>
              <Text size="sm" className="font-mono text-ws-fg">
                {preview}
              </Text>
            </div>

            {/* Reset button */}
            <Inline justify="end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onChange(DEFAULT_NAMING_CONFIG)}
              >
                Reset to Defaults
              </Button>
            </Inline>
          </Stack>
        </div>
      )}
    </div>
  );
}
