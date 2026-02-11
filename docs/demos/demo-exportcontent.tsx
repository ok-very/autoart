import React, { useState, useEffect } from 'react';
import { 
  FileText, Table, FileJson, Cloud, Check, AlertCircle, 
  Clock, Mail, Download, ChevronRight, X, LayoutTemplate
} from 'lucide-react';

// --- Types & Mock Data ---

type Project = {
  id: string;
  name: string;
  code: string;
  status: 'Active' | 'On Hold' | 'Completed';
  last_updated: string; // ISO date
  health: 'good' | 'stale' | 'decay';
  contacts_count: number;
};

const MOCK_PROJECTS: Project[] = [
  { id: 'p1', name: 'Broadview Village - P1', code: 'BV-01', status: 'Active', last_updated: '2026-02-08', health: 'good', contacts_count: 4 },
  { id: 'p2', name: 'West End Community Ctr', code: 'WECC', status: 'Active', last_updated: '2026-01-15', health: 'stale', contacts_count: 2 },
  { id: 'p3', name: 'Downtown Sculpture Walk', code: 'DSW', status: 'On Hold', last_updated: '2026-02-01', health: 'decay', contacts_count: 8 },
  { id: 'p4', name: 'River District Phase 2', code: 'RD-02', status: 'Active', last_updated: '2026-02-09', health: 'good', contacts_count: 5 },
  { id: 'p5', name: 'Main St Mural', code: 'MSM', status: 'Completed', last_updated: '2025-12-10', health: 'good', contacts_count: 1 },
];

type Format = {
  id: string;
  label: string;
  icon: React.ElementType;
  group: 'document' | 'data' | 'cloud';
  desc: string;
};

const FORMATS: Format[] = [
  { id: 'pdf', label: 'PDF Report', icon: FileText, group: 'document', desc: 'Standard deliverable' },
  { id: 'docx', label: 'Word Doc', icon: FileText, group: 'document', desc: 'Editable report' },
  { id: 'csv', label: 'CSV Data', icon: Table, group: 'data', desc: 'Raw table data' },
  { id: 'json', label: 'JSON', icon: FileJson, group: 'data', desc: 'Machine readable' },
  { id: 'gdoc', label: 'Google Doc', icon: Cloud, group: 'cloud', desc: 'Live cloud doc' },
];

const SECTIONS = [
  { id: 'summary', label: 'Executive Summary', default: true },
  { id: 'contacts', label: 'Key Contacts', default: true },
  { id: 'budget', label: 'Budget Status', default: true },
  { id: 'milestones', label: 'Milestone Timeline', default: true },
  { id: 'risks', label: 'Risk Register', default: false },
  { id: 'images', label: 'Artwork Imagery', default: true },
];

// --- Components ---

const FormatCard = ({ format, selected, onSelect }: { format: Format, selected: boolean, onSelect: (id: string) => void }) => (
  <button
    onClick={() => onSelect(format.id)}
    className={`
      flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all duration-150 h-32 w-full
      ${selected 
        ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 shadow-sm' 
        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm hover:-translate-y-0.5'}
    `}
  >
    <format.icon className={`w-8 h-8 mb-3 ${selected ? 'text-blue-600' : 'text-slate-400'}`} strokeWidth={1.5} />
    <span className={`text-sm font-semibold block mb-1 ${selected ? 'text-blue-900' : 'text-slate-700'}`}>
      {format.label}
    </span>
    <span className="text-[10px] text-slate-500">{format.desc}</span>
  </button>
);

const Toggle = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean) => void }) => (
  <div 
    onClick={() => onChange(!checked)}
    className={`
      flex items-center justify-between p-3 rounded-lg border cursor-pointer select-none transition-all
      ${checked ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-50 border-transparent opacity-70 hover:opacity-100'}
    `}
  >
    <span className={`text-sm font-medium ${checked ? 'text-slate-900' : 'text-slate-500'}`}>{label}</span>
    <div className={`
      w-9 h-5 rounded-full relative transition-colors duration-200
      ${checked ? 'bg-emerald-600' : 'bg-slate-300'}
    `}>
      <div className={`
        absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200
        ${checked ? 'translate-x-4' : 'translate-x-0'}
      `} />
    </div>
  </div>
);

// --- Main Application ---

export default function ExportInterface() {
  // State
  const [selectedIds, setSelectedIds] = useState<string[]>(['p1', 'p2', 'p4']);
  const [formatId, setFormatId] = useState('pdf');
  const [config, setConfig] = useState<Record<string, boolean>>(
    SECTIONS.reduce((acc, s) => ({ ...acc, [s.id]: s.default }), {})
  );
  const [isExporting, setIsExporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Derived
  const selectedProjects = MOCK_PROJECTS.filter(p => selectedIds.includes(p.id));
  const staleCount = selectedProjects.filter(p => p.health === 'stale').length;
  const decayCount = selectedProjects.filter(p => p.health === 'decay').length;

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setResult(`Export_${new Date().toISOString().split('T')[0]}.pdf`);
    }, 1500);
  };

  const toggleProject = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Render Result State
  if (result) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8" strokeWidth={3} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Export Ready</h2>
          <p className="text-slate-600 mb-8">
            Your {FORMATS.find(f => f.id === formatId)?.label} containing {selectedIds.length} projects is ready.
          </p>
          <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 mb-3 shadow-sm transition-all">
            <Download className="w-4 h-4" /> Download File
          </button>
          <button 
            onClick={() => setResult(null)}
            className="w-full py-3 bg-white border border-slate-200 text-slate-600 font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            Start New Export
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* 1. SELECTION SIDEBAR */}
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">1. Select Projects</h2>
          <p className="text-sm font-medium text-slate-700">{selectedIds.length} projects selected</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {MOCK_PROJECTS.map(project => {
            const isSelected = selectedIds.includes(project.id);
            return (
              <div 
                key={project.id}
                onClick={() => toggleProject(project.id)}
                className={`
                  group flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-all duration-150
                  ${isSelected ? 'bg-blue-50/60 border-blue-200' : 'bg-transparent border-transparent hover:bg-slate-50'}
                `}
              >
                <div className={`
                  mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors
                  ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white group-hover:border-slate-400'}
                `}>
                  {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium truncate ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                    {project.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-400 font-mono bg-slate-50 px-1 rounded">{project.code}</span>
                    {project.health === 'stale' && <span className="w-2 h-2 rounded-full bg-amber-400" title="Stale Data" />}
                    {project.health === 'decay' && <span className="w-2 h-2 rounded-full bg-orange-500" title="Unanswered Outreach" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* 2. CONFIGURATION MAIN AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-8 md:p-12 space-y-10">
            
            {/* Context Intelligence Banner */}
            {(staleCount > 0 || decayCount > 0) && (
              <div className="bg-white border border-amber-200 rounded-xl p-4 flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-1">Pre-flight Check</h3>
                  <div className="text-sm text-slate-600 space-y-1">
                    {staleCount > 0 && <p>• {staleCount} projects haven't been updated in 14+ days.</p>}
                    {decayCount > 0 && <p>• {decayCount} projects have unanswered outreach.</p>}
                  </div>
                  <button className="text-xs font-bold text-amber-700 mt-3 hover:underline">Review affected projects</button>
                </div>
              </div>
            )}

            {/* Step 2: Format */}
            <section>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">2. Configure Format</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {FORMATS.map(f => (
                  <FormatCard 
                    key={f.id} 
                    format={f} 
                    selected={formatId === f.id} 
                    onSelect={setFormatId} 
                  />
                ))}
              </div>
            </section>

            {/* Step 3: Content */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Included Sections</h2>
                <button 
                  onClick={() => setConfig(SECTIONS.reduce((acc, s) => ({...acc, [s.id]: true}), {}))}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700"
                >
                  Select All
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {SECTIONS.map(section => (
                  <Toggle 
                    key={section.id} 
                    label={section.label} 
                    checked={!!config[section.id]} 
                    onChange={(val) => setConfig({...config, [section.id]: val})} 
                  />
                ))}
              </div>
            </section>

          </div>
        </div>

        {/* Footer / Action Bar */}
        <div className="p-6 border-t border-slate-200 bg-white flex items-center justify-between shrink-0 z-20">
          <div className="text-sm text-slate-500">
            Exporting <strong className="text-slate-900">{selectedIds.length} Projects</strong> as <strong className="text-slate-900 uppercase">{formatId}</strong>
          </div>
          <button 
            onClick={handleExport}
            disabled={isExporting || selectedIds.length === 0}
            className={`
              px-8 py-3 rounded-lg font-bold text-sm text-white shadow-sm flex items-center gap-2 transition-all
              ${isExporting || selectedIds.length === 0 
                ? 'bg-slate-300 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md hover:-translate-y-0.5'}
            `}
          >
            {isExporting ? (
              <>Processing...</>
            ) : (
              <>Export Document <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </main>

      {/* 3. PREVIEW PANEL (Material Honesty) */}
      <aside className="w-[480px] bg-slate-100 border-l border-slate-200 flex flex-col hidden 2xl:flex">
        <div className="p-6 border-b border-slate-200 bg-white/50 backdrop-blur">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Output Preview</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8">
          {/* Document Paper Mockup */}
          <div className="bg-white shadow-lg shadow-slate-200/50 border border-slate-200/60 min-h-[600px] p-10 mx-auto max-w-full text-xs text-slate-800 font-serif leading-relaxed transform origin-top transition-all">
            
            {/* Header */}
            <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-8">
              <div>
                <div className="font-bold text-xl font-sans tracking-tight">AutoArt</div>
                <div className="text-slate-400 text-[10px] font-sans uppercase tracking-widest mt-1">Export System</div>
              </div>
              <div className="text-right text-slate-500 font-sans">
                {new Date().toLocaleDateString()}
              </div>
            </div>

            {/* Content Preview */}
            {selectedProjects.length === 0 ? (
              <div className="text-center py-20 text-slate-400 italic font-sans">
                Select projects to preview content...
              </div>
            ) : (
              <div className="space-y-8">
                {selectedProjects.map(project => (
                  <div key={project.id} className="break-inside-avoid">
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="font-bold text-sm font-sans uppercase tracking-wide text-slate-900">{project.name}</h3>
                      <span className="text-[10px] font-mono text-slate-400">{project.code}</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-3 border-b border-slate-100 pb-3">
                      <div>
                        <span className="block text-[9px] text-slate-400 uppercase font-sans font-bold">Status</span>
                        {project.status}
                      </div>
                      <div>
                        <span className="block text-[9px] text-slate-400 uppercase font-sans font-bold">Updated</span>
                        {project.last_updated}
                      </div>
                      {config.budget && (
                        <div>
                          <span className="block text-[9px] text-slate-400 uppercase font-sans font-bold">Budget</span>
                          <span className="text-emerald-700 font-medium">On Track</span>
                        </div>
                      )}
                    </div>

                    {config.contacts && (
                      <div className="mb-3">
                        <span className="block text-[9px] text-slate-400 uppercase font-sans font-bold mb-1">Stakeholders</span>
                        <div className="flex gap-2">
                          {[...Array(project.contacts_count)].map((_, i) => (
                            <div key={i} className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200" />
                          ))}
                        </div>
                      </div>
                    )}

                    {config.summary && (
                      <p className="text-slate-600 mb-2">
                        Project initiation complete. Site survey scheduled for next week. 
                        Initial stakeholder meetings have yielded positive feedback regarding the art direction.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

    </div>
  );
}