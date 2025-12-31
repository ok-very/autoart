import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import { ProgressBar } from '../common/ProgressBar';
import { calculateStatusDistribution, StatusKey } from '../../utils/statusUtils';

// Temporary styles to match the reference HTML's sticky behaviors that are tricky with just Tailwind utilities
const STICKY_STYLES = `
  .custom-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
  .custom-scroll::-webkit-scrollbar-track { background: transparent; }
  .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  .custom-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
`;

export function ProjectListView() {
  const { selectedProjectId, getNode } = useHierarchyStore();
  const selectedProject = selectedProjectId ? getNode(selectedProjectId) : null;

  // Mock Data State for Demonstration
  const [tasks, setTasks] = useState([
    { id: 't1', title: 'Intro Meeting with Client', status: 'done', assignee: '?', date: '2025-10-12', template: 'tmpl_intro_client_v2' },
    { id: 't2', title: 'Documentation Request', status: 'working', assignee: 'SJ', date: '2025-10-13', template: 'tmpl_doc_req_formal' },
    { id: 't3', title: 'Billing Info Request', status: 'stuck', assignee: 'MR', date: '2025-10-14', template: 'tmpl_billing_v1' },
    { id: 't4', title: 'Scope Definition', status: 'empty', assignee: '', date: '', template: '' },
  ]);

  const handleUpdateTask = (id: string, updates: Partial<typeof tasks[0]>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const distribution = useMemo(() => 
    calculateStatusDistribution(tasks, (t) => t.status), 
  [tasks]);

  if (!selectedProject) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400">
        <div className="text-center">
          <p className="text-lg font-medium">No project selected</p>
          <p className="text-sm">Select a project from the top menu</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white relative">
      <style>{STICKY_STYLES}</style>
      
      {/* Main Grid Workspace */}
      <div className="flex-1 overflow-auto custom-scroll" id="grid-container">
        
        {/* ==========================
             MAIN TABLE HEADER
             ========================== */}
        <div className="flex h-10 w-min min-w-full z-40">
          {/* Sticky Columns */}
          <div className="w-10 sticky left-0 z-40 bg-white border-b-2 border-r border-slate-200 flex items-center justify-center">
            <input type="checkbox" className="rounded border-slate-300 text-blue-600" />
          </div>
          <div className="w-[360px] sticky left-10 z-40 bg-white border-b-2 border-r border-slate-200 flex items-center px-4 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">
            <span className="text-xs font-bold text-slate-600 uppercase">Item Name</span>
          </div>

          {/* Scrollable Columns */}
          <div className="w-32 sticky top-0 z-30">
            <span className="text-xs font-bold text-slate-600 uppercase">Status</span>
          </div>
          <div className="w-24 sticky top-0 z-30">
            <span className="text-xs font-bold text-slate-600 uppercase">Owner</span>
          </div>
          <div className="w-32 sticky top-0 z-30">
            <span className="text-xs font-bold text-slate-600 uppercase">Timeline / Date</span>
          </div>
          <div className="w-48 sticky top-0 z-30">
            <span className="text-xs font-bold text-slate-600 uppercase">Context / Details</span>
          </div>
          <div className="w-24 sticky top-0 z-30">
            <span className="text-xs font-bold text-slate-600 uppercase">Files</span>
          </div>
          <div className="flex-1 sticky top-0 z-40 bg-white border-b-2 min-w-[50px]"></div>
        </div>

        {/* ==========================
             STAGE GROUP 1
             ========================== */}
        <div className="group-section">
          {/* Group Header */}
          <div className="sticky top-10 z-25 bg-white/95 backdrop-blur pt-4 pb-2 px-4 flex items-center gap-2 border-b border-slate-100">
            <button className="text-blue-500 hover:text-blue-700 transition-transform">
              <ChevronDown size={16} />
            </button>
            <h2 className="text-lg font-bold text-blue-600">Stage 1: Project Initiation</h2>
            <div className="h-px bg-blue-100 flex-1 ml-2"></div>
          </div>

          {/* TASK 1: PROJECT INTRODUCTION (Parent) */}
          <TaskRow 
            title="Project Introduction" 
            status="done" 
            owner="SJ" 
            timeline="Oct 12 - 15"
            progress={100}
            fileCount={3}
            defaultOpen={true}
            subItems={tasks}
            onUpdateSubItem={handleUpdateTask}
          />
          
          {/* TASK 2: FEE PROPOSAL */}
          <TaskRow 
            title="BFA Fee Proposal" 
            status="empty" 
            owner="" 
            timeline=""
            progress={0}
            fileCount={0}
            defaultOpen={false}
            subItems={[]}
          />
        </div>

        {/* FOOTER SUMMARY (Progress Widget) */}
        <div className="flex h-12 w-min min-w-full bg-white border-b border-slate-300 shadow-inner sticky bottom-0 z-50">
            <div className="w-10 sticky left-0 bg-white border-r border-slate-200"></div>
            <div className="w-[360px] sticky left-10 bg-white border-r border-slate-200 flex items-center justify-end px-4 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]">
                <span className="text-xs font-bold text-slate-400 uppercase">Total Progress</span>
            </div>
            
            {/* THE INTERACTIVE PROGRESS BAR */}
            <div className="w-32 border-r border-slate-200 flex items-center justify-center px-2">
                <ProgressBar distribution={distribution} height="24px" />
            </div>

            <div className="w-24 border-r border-slate-200"></div>
            <div className="flex-1"></div>
        </div>

      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------

interface TaskRowProps {
  title: string;
  status: StatusKey;
  owner: string;
  timeline: string;
  progress: number;
  fileCount: number;
  defaultOpen?: boolean;
  subItems: any[];
  onUpdateSubItem?: (id: string, updates: any) => void;
}

function TaskRow({ title, status, owner, timeline, progress, fileCount, defaultOpen = false, subItems, onUpdateSubItem }: TaskRowProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [currentStatus, setCurrentStatus] = useState<StatusKey>(status);

  const statusColors: Record<string, string> = {
    'done': 'bg-[#00c875]',
    'working': 'bg-[#fdab3d]',
    'stuck': 'bg-[#e2445c]',
    'empty': 'bg-[#c4c4c4]',
  };

  const statusLabels: Record<string, string> = {
    'done': 'Done',
    'working': 'Working',
    'stuck': 'Stuck',
    'empty': '',
  };

  return (
    <div className="task-group mb-1">
      {/* PARENT ROW */}
      <div className="flex h-10 w-min min-w-full hover:bg-slate-50 transition-colors group/row border-b border-slate-100">
        <div className="w-10 sticky left-0 z-20 bg-white group-hover/row:bg-slate-50 border-r border-slate-200 flex items-center justify-center">
          <input type="checkbox" className="rounded border-slate-300" />
        </div>
        <div className="w-[360px] sticky left-10 z-20 bg-white group-hover/row:bg-slate-50 border-r border-slate-200 flex items-center px-2 relative shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500"></div> {/* Color Bar */}
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            className={`w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-700 mr-1 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
          >
            <ChevronDown size={16} />
          </button>
          <input 
            type="text" 
            defaultValue={title} 
            className="w-full bg-transparent border-none text-sm font-semibold text-slate-800 focus:ring-0 focus:outline-none" 
          />
        </div>
        
        {/* Parent Columns */}
        <div className="w-32 border-r border-slate-100 p-1 bg-white group-hover/row:bg-slate-50">
          <div className={`w-full h-full flex items-center justify-center text-white text-xs font-medium cursor-pointer transition-all hover:brightness-105 ${statusColors[currentStatus] || statusColors['empty']}`}>
            {statusLabels[currentStatus] || ''}
          </div>
        </div>
        <div className="w-24 border-r border-slate-100 flex items-center justify-center bg-white group-hover/row:bg-slate-50">
          {owner && (
            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center border border-white shadow-sm">
              {owner}
            </div>
          )}
        </div>
        <div className="w-32 border-r border-slate-100 flex items-center justify-center text-xs bg-white group-hover/row:bg-slate-50">
          {timeline}
        </div>
        <div className="w-48 border-r border-slate-100 flex items-center justify-center px-4 bg-white group-hover/row:bg-slate-50">
          {/* Parent Timeline Bar */}
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
        <div className="w-24 border-r border-slate-100 flex items-center justify-center bg-white group-hover/row:bg-slate-50">
          {fileCount > 0 && <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{fileCount} Files</span>}
        </div>
        <div className="flex-1 bg-white group-hover/row:bg-slate-50 min-w-[50px]"></div>
      </div>

      {/* SUBPROCESS CONTAINER (Collapsible) */}
      {isOpen && (
        <div className="bg-slate-50/50">
          {/* === NESTED HEADER ROW === */}
          <div className="flex h-8 w-min min-w-full bg-[#f8fafc] border-y border-slate-200">
            <div className="w-10 sticky left-0 z-10 bg-slate-50 border-r border-slate-200"></div>
            <div className="w-[360px] sticky left-10 z-10 bg-slate-50 border-r border-slate-200 flex items-center pl-10 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Subprocess Steps</span>
            </div>
            <div className="w-32 flex items-center justify-center text-[10px] font-bold uppercase text-slate-500 tracking-wider border-r border-slate-200">Task Status</div>
            <div className="w-24 flex items-center justify-center text-[10px] font-bold uppercase text-slate-500 tracking-wider border-r border-slate-200">Assignee</div>
            <div className="w-32 flex items-center justify-center text-[10px] font-bold uppercase text-slate-500 tracking-wider border-r border-slate-200">Target Date</div>
            <div className="w-48 flex items-center justify-center text-[10px] font-bold uppercase text-yellow-700 bg-yellow-50 tracking-wider border-r border-slate-200">Email Template</div>
            <div className="w-24 flex items-center justify-center text-[10px] font-bold uppercase text-slate-500 tracking-wider border-r border-slate-200">Outputs</div>
            <div className="flex-1 bg-slate-50 min-w-[50px]"></div>
          </div>

          {/* Subitems */}
          {subItems.map((item, index) => (
             <SubItemRow 
               key={item.id}
               title={item.title} 
               status={item.status} 
               assignee={item.assignee} 
               date={item.date} 
               template={item.template}
               isLast={index === subItems.length - 1}
               onUpdate={(updates) => onUpdateSubItem?.(item.id, updates)}
             />
          ))}

          {/* Add Subitem Row */}
          <div className="flex h-8 w-min min-w-full bg-slate-50 border-b border-slate-200">
            <div className="w-10 sticky left-0 z-10 bg-slate-50 border-r border-slate-200"></div>
            <div className="w-[360px] sticky left-10 z-10 bg-slate-50 border-r border-slate-200 flex items-center pl-12 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]">
               <input type="text" placeholder="+ Add Subprocess" className="text-xs text-slate-400 placeholder-slate-400 bg-transparent border-none focus:ring-0 w-full hover:text-slate-600 cursor-pointer focus:outline-none" />
            </div>
            <div className="flex-1"></div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SubItemRowProps {
  title: string;
  status: StatusKey;
  assignee: string;
  date: string;
  template: string;
  isLast: boolean;
  onUpdate?: (updates: any) => void;
}

function SubItemRow({ title, status, assignee, date, template, isLast, onUpdate }: SubItemRowProps) {
    const statusColors: Record<string, string> = {
        'done': 'bg-[#00c875]',
        'working': 'bg-[#fdab3d]',
        'stuck': 'bg-[#e2445c]',
        'empty': 'bg-[#c4c4c4]',
      };

    const statusLabels: Record<string, string> = {
      'done': 'Done',
      'working': 'Working',
      'stuck': 'Stuck',
      'empty': 'Empty',
    };

    return (
        <div className="flex h-9 w-min min-w-full hover:bg-slate-100 transition-colors group/sub border-b border-slate-100/50">
            <div className="w-10 sticky left-0 z-10 bg-slate-50 border-r border-slate-200"></div>
            <div className="w-[360px] sticky left-10 z-10 bg-slate-50 border-r border-slate-200 flex items-center pl-10 relative shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]">
                {/* Visual Tree Connectors */}
                <div className={`absolute left-6 top-[-15px] w-0.5 bg-slate-300 z-10 ${isLast ? 'h-[33px]' : 'bottom-[-18px]'}`}></div>
                <div className="absolute left-6 top-1/2 w-3 h-0.5 bg-slate-300 z-10"></div>
                
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => onUpdate?.({ title: e.target.value })}
                  className="w-full bg-transparent border-none text-xs text-slate-600 focus:ring-0 focus:outline-none" 
                />
            </div>
            
            {/* Columns */}
            <div className="w-32 border-r border-slate-200 p-1">
                <div className="w-full h-full relative">
                  <select
                    value={status}
                    onChange={(e) => onUpdate?.({ status: e.target.value as StatusKey })}
                    className={`w-full h-full text-[10px] font-medium text-center text-white appearance-none cursor-pointer outline-none rounded-sm ${statusColors[status]}`}
                    style={{ textAlignLast: 'center' }}
                  >
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <option key={key} value={key} className="bg-white text-slate-800">
                        {label || 'Empty'}
                      </option>
                    ))}
                  </select>
                </div>
            </div>
            <div className="w-24 border-r border-slate-200 flex items-center justify-center">
                <input 
                    type="text"
                    value={assignee}
                    onChange={(e) => onUpdate?.({ assignee: e.target.value })}
                    className={`w-5 h-5 rounded-full text-[9px] font-bold text-center flex items-center justify-center p-0 border-none focus:ring-0 focus:outline-none ${assignee === '?' || !assignee ? 'bg-gray-200 text-gray-500' : 'bg-indigo-100 text-indigo-600'}`}
                    maxLength={2}
                />
            </div>
            <div className={`w-32 border-r border-slate-200 flex items-center justify-center text-xs ${status === 'stuck' ? 'text-red-500 font-bold' : 'text-slate-500'}`}>
                <input 
                  type="date"
                  value={date}
                  onChange={(e) => onUpdate?.({ date: e.target.value })}
                  className="bg-transparent border-none text-xs text-center focus:ring-0 focus:outline-none w-full h-full cursor-pointer"
                />
            </div>
            <div className="w-48 border-r border-slate-200 px-2 flex items-center bg-yellow-50/30">
                <input 
                  type="text"
                  value={template}
                  onChange={(e) => onUpdate?.({ template: e.target.value })}
                  className="w-full bg-transparent border-none text-[10px] font-mono text-slate-500 truncate focus:ring-0 focus:outline-none hover:text-blue-600 hover:underline cursor-pointer"
                />
            </div>
            <div className="w-24 border-r border-slate-200"></div>
            <div className="flex-1 min-w-[50px]"></div>
        </div>
    );
}
