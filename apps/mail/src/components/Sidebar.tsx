// Sidebar component with view toggle, bucket/request filters, and project list
// Adapted from demo-triage-inbox.html

import {
    Inbox, CheckCircle2, Clock, FileText, Calendar, AlertCircle,
    Activity, Send, Hourglass, Hash
} from 'lucide-react';
import type { ProcessedEmail, TriageBucket } from '../lib';

export type ViewMode = 'triage' | 'requests';
export type RequestTab = 'pending' | 'received' | 'sent';

interface SidebarProps {
    activeView: ViewMode;
    onViewChange: (view: ViewMode) => void;
    activeBucket: TriageBucket | 'ALL';
    onBucketChange: (bucket: TriageBucket | 'ALL') => void;
    activeProject: string | null;
    onProjectChange: (project: string | null) => void;
    requestTab: RequestTab;
    onRequestTabChange: (tab: RequestTab) => void;
    emails: ProcessedEmail[];
    currentUserEmail?: string;
}

const BUCKETS = [
    { id: 'ALL' as const, label: 'All Mail', icon: Inbox, color: 'text-slate-500' },
    { id: 'ACTION_REQUIRED' as const, label: 'Action Required', icon: AlertCircle, color: 'text-orange-500' },
    { id: 'APPROVAL_NEEDED' as const, label: 'Needs Approval', icon: CheckCircle2, color: 'text-emerald-500' },
    { id: 'MEETING_SCHEDULE' as const, label: 'Scheduling', icon: Calendar, color: 'text-blue-500' },
    { id: 'INVOICE' as const, label: 'Invoices', icon: FileText, color: 'text-purple-500' },
    { id: 'TASK_ASSIGNMENT' as const, label: 'Task Updates', icon: Activity, color: 'text-pink-500' },
    { id: 'FYI_ONLY' as const, label: 'FYI', icon: Clock, color: 'text-slate-400' },
];

export function Sidebar({
    activeView,
    onViewChange,
    activeBucket,
    onBucketChange,
    activeProject,
    onProjectChange,
    requestTab,
    onRequestTabChange,
    emails,
    currentUserEmail = 'me@company.com',
}: SidebarProps) {
    // Count pending actions
    const pendingCount = emails.filter(e =>
        e.from !== currentUserEmail &&
        (e.triage?.bucket === 'ACTION_REQUIRED' || e.triage?.bucket === 'APPROVAL_NEEDED')
    ).length;

    // Get unique projects
    const projects = Array.from(new Set(emails.map(e => e.projectName).filter(Boolean)));

    return (
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm">
            {/* Logo */}
            <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                    A
                </div>
                <h1 className="font-bold text-lg tracking-tight">AutoMail</h1>
            </div>

            {/* View Toggle */}
            <div className="p-4 pb-0">
                <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                    <button
                        onClick={() => onViewChange('triage')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${activeView === 'triage'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Inbox
                    </button>
                    <button
                        onClick={() => onViewChange('requests')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${activeView === 'requests'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Requests
                    </button>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-4 pt-0 space-y-1">
                {activeView === 'requests' ? (
                    /* REQUESTS MENU */
                    <div className="space-y-1">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2 mt-2">
                            Request Status
                        </div>

                        <button
                            onClick={() => onRequestTabChange('pending')}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${requestTab === 'pending' ? 'bg-orange-50 text-orange-700' : 'text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Hourglass size={18} className={requestTab === 'pending' ? 'text-orange-600' : 'text-slate-400'} />
                                <span className="text-sm font-medium">Pending Action</span>
                            </div>
                            <span className="text-xs font-bold bg-white px-1.5 py-0.5 rounded-md shadow-sm text-slate-500">
                                {pendingCount}
                            </span>
                        </button>

                        <button
                            onClick={() => onRequestTabChange('received')}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${requestTab === 'received' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Inbox size={18} className={requestTab === 'received' ? 'text-blue-600' : 'text-slate-400'} />
                                <span className="text-sm font-medium">Received</span>
                            </div>
                        </button>

                        <button
                            onClick={() => onRequestTabChange('sent')}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${requestTab === 'sent' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Send size={18} className={requestTab === 'sent' ? 'text-emerald-600' : 'text-slate-400'} />
                                <span className="text-sm font-medium">Sent</span>
                            </div>
                        </button>
                    </div>
                ) : (
                    /* TRIAGE MENU */
                    <div className="space-y-1">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2 mt-2">
                            Buckets
                        </div>
                        {BUCKETS.map(bucket => {
                            const IconComponent = bucket.icon;
                            const count = bucket.id === 'ALL'
                                ? emails.filter(e => e.from !== currentUserEmail).length
                                : emails.filter(e => e.from !== currentUserEmail && e.triage?.bucket === bucket.id).length;

                            return (
                                <button
                                    key={bucket.id}
                                    onClick={() => onBucketChange(bucket.id)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${activeBucket === bucket.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <IconComponent
                                            size={18}
                                            className={activeBucket === bucket.id ? 'text-blue-600' : bucket.color}
                                        />
                                        <span className="text-sm font-medium">{bucket.label}</span>
                                    </div>
                                    <span className="text-xs opacity-60">{count}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Projects */}
                <div className="pt-6 text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
                    Projects
                </div>
                <button
                    onClick={() => onProjectChange(null)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${!activeProject
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100'}`}
                >
                    <Hash size={16} className={!activeProject ? 'text-blue-600' : 'text-slate-400'} />
                    <span className="text-sm font-medium">All Projects</span>
                </button>
                {projects.map(project => {
                    const count = emails.filter(e => e.projectName === project).length;
                    return (
                        <button
                            key={project}
                            onClick={() => onProjectChange(project)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${activeProject === project
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <div className="flex items-center gap-3">
                                <Hash size={16} className={activeProject === project ? 'text-blue-600' : 'text-slate-400'} />
                                <span className="text-sm font-medium">{project}</span>
                            </div>
                            <span className="text-xs opacity-60">{count}</span>
                        </button>
                    );
                })}
            </nav>

            {/* User */}
            <div className="p-4 border-t border-slate-100">
                <div className="flex items-center gap-3 px-2 py-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold">
                        NB
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-semibold truncate">Neal Ballard</p>
                        <p className="text-[10px] text-slate-400 truncate">Project Manager</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
