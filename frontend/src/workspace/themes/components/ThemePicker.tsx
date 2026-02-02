/**
 * Theme Picker Component
 *
 * UI for selecting workspace themes.
 * Can be placed in settings, toolbar, or command palette.
 */

import { Check, Palette } from 'lucide-react';
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from '@autoart/ui';
import {
  useAvailableThemes,
  useWorkspaceThemeId,
  setWorkspaceTheme,
} from '../useWorkspaceTheme';
import type { WorkspaceThemeModule } from '../types';

export function ThemePicker() {
  const themes = useAvailableThemes();
  const currentThemeId = useWorkspaceThemeId();

  const themesByVariant = themes.reduce(
    (acc, theme) => {
      const variant = theme.variant || 'other';
      if (!acc[variant]) acc[variant] = [];
      acc[variant].push(theme);
      return acc;
    },
    {} as Record<string, WorkspaceThemeModule[]>
  );

  return (
    <Dropdown>
      <DropdownTrigger className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors">
        <Palette size={16} />
        <span>Theme</span>
      </DropdownTrigger>
      <DropdownContent align="end" className="w-56">
        <DropdownLabel>Workspace Theme</DropdownLabel>

        {Object.entries(themesByVariant).map(([variant, variantThemes]) => (
          <div key={variant}>
            <DropdownSeparator />
            <DropdownLabel className="capitalize">{variant}</DropdownLabel>
            {variantThemes.map((theme) => (
              <DropdownItem
                key={theme.id}
                onSelect={() => setWorkspaceTheme(theme.id)}
                className="flex items-center justify-between"
              >
                <div className="flex flex-col">
                  <span>{theme.label}</span>
                  {theme.description && (
                    <span className="text-xs text-slate-500">{theme.description}</span>
                  )}
                </div>
                {currentThemeId === theme.id && (
                  <Check size={16} className="text-blue-500" />
                )}
              </DropdownItem>
            ))}
          </div>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}

export function ThemePickerMinimal() {
  const themes = useAvailableThemes();
  const currentThemeId = useWorkspaceThemeId();
  const currentTheme = themes.find((t) => t.id === currentThemeId);

  return (
    <Dropdown>
      <DropdownTrigger className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors">
        <Palette size={12} />
        <span>{currentTheme?.label || 'Theme'}</span>
      </DropdownTrigger>
      <DropdownContent align="end" className="w-44">
        {themes.map((theme) => (
          <DropdownItem
            key={theme.id}
            onSelect={() => setWorkspaceTheme(theme.id)}
            className="flex items-center justify-between text-sm"
          >
            <span>{theme.label}</span>
            {currentThemeId === theme.id && <Check size={14} className="text-blue-500" />}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}
