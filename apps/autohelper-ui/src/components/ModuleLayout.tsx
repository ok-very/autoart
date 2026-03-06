import type { ReactNode } from 'react';
import { ModuleSidebar } from './ModuleSidebar';
import { MODULES } from './moduleRegistry';

interface ModuleLayoutProps {
  module: string;
  activePage: string;
  children: ReactNode;
}

export function ModuleLayout({ module, activePage, children }: ModuleLayoutProps) {
  const config = MODULES[module];
  if (!config) return <>{children}</>;

  return (
    <div className="module-layout">
      <ModuleSidebar
        moduleName={config.name}
        pages={config.pages}
        settingsHref={config.settingsHref}
        activePage={activePage}
      />
      <main className="module-content">
        {children}
      </main>
    </div>
  );
}
