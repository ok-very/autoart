/**
 * Appearance Section
 *
 * Settings page section for visual preferences:
 * - Workspace theme selection
 * - Theme density
 */

import { Palette, Check, Layout, Maximize2, Minimize2, BookOpen } from 'lucide-react';

import {
  WORKSPACE_THEME_LABELS,
  WORKSPACE_THEME_DESCRIPTIONS,
  type WorkspaceThemeId,
} from '@autoart/shared';
import {
  useWorkspaceThemeId,
  useAvailableThemes,
  setWorkspaceTheme,
} from '../../workspace/themes';

const THEME_ICONS: Record<WorkspaceThemeId, React.ReactNode> = {
  default: <Layout className="w-5 h-5" />,
  compact: <Minimize2 className="w-5 h-5" />,
  floating: <Maximize2 className="w-5 h-5" />,
  minimal: <Palette className="w-5 h-5" />,
  parchment: <BookOpen className="w-5 h-5" />,
};

const THEME_PREVIEWS: Record<WorkspaceThemeId, string> = {
  default: 'bg-ws-panel-bg border-ws-panel-border',
  compact: 'bg-ws-bg border-slate-300',
  floating: 'bg-slate-100 border-transparent shadow-md rounded-lg',
  minimal: 'bg-ws-panel-bg border-transparent',
  parchment: 'bg-[#F5F2ED] border-[#D6D2CB]',
};

export function AppearanceSection() {
  const currentThemeId = useWorkspaceThemeId();
  const availableThemes = useAvailableThemes();

  const handleThemeSelect = (themeId: string) => {
    setWorkspaceTheme(themeId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-ws-h2 font-semibold text-ws-fg">Appearance</h2>
        <p className="text-sm text-ws-text-secondary mt-1">
          Customize the look and feel of your workspace
        </p>
      </div>

      {/* Workspace Theme */}
      <div className="bg-ws-panel-bg rounded-xl border border-ws-panel-border p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Palette className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-medium text-ws-fg">Workspace Theme</h3>
            <p className="text-sm text-ws-text-secondary">
              Choose how panels and tabs appear in your workspace
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {availableThemes.map((theme) => {
            const themeId = theme.id as WorkspaceThemeId;
            const isKnownTheme = themeId in THEME_ICONS;
            const isSelected = currentThemeId === themeId;
            const label = WORKSPACE_THEME_LABELS[themeId] || theme.label;
            const description = WORKSPACE_THEME_DESCRIPTIONS[themeId] || theme.description;
            const icon = isKnownTheme ? THEME_ICONS[themeId] : <Palette className="w-5 h-5" />;
            const previewClass = THEME_PREVIEWS[themeId] || 'bg-ws-panel-bg border-ws-panel-border';

            return (
              <button
                key={themeId}
                onClick={() => handleThemeSelect(themeId)}
                className={`
                  relative flex flex-col p-4 rounded-lg border-2 transition-all text-left
                  ${isSelected
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : 'border-ws-panel-border hover:border-slate-300 hover:bg-ws-bg'
                  }
                `}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}

                {/* Theme preview mini */}
                <div className={`w-full h-12 mb-3 rounded border ${previewClass} flex items-center justify-center`}>
                  <div className="flex gap-1">
                    <div className="w-8 h-6 bg-slate-200 rounded-sm" />
                    <div className="w-8 h-6 bg-slate-100 rounded-sm" />
                    <div className="w-8 h-6 bg-slate-100 rounded-sm" />
                  </div>
                </div>

                {/* Label and description */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-ws-text-secondary">{icon}</span>
                  <span className="font-medium text-ws-fg">{label}</span>
                </div>
                <p className="text-xs text-ws-text-secondary leading-relaxed">
                  {description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Future: Additional appearance settings */}
      {/* 
      <div className="bg-ws-panel-bg rounded-xl border border-ws-panel-border p-5">
        <h3 className="font-medium text-ws-fg mb-3">Display Density</h3>
        ...
      </div>
      */}
    </div>
  );
}

export default AppearanceSection;
