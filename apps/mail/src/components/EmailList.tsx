// EmailList component - Main email list with search, filters, and decay meter
// Adapted from demo-triage-inbox.html

import {
    Search, Filter, Paperclip, Mail,
    Inbox, CheckCircle2, Clock, FileText, Calendar, AlertCircle, Activity
} from 'lucide-react';
import type { ProcessedEmail, TriageBucket } from '../lib';
import type { ViewMode } from './Sidebar';
import { DecayMeter } from './DecayMeter';

interface EmailListProps {
    emails: ProcessedEmail[];
    selectedId: string | null;
    onSelectEmail: (email: ProcessedEmail) => void;
    activeView: ViewMode;
    searchQuery: string;
    onSearchChange: (query: string) => void;
}

const BUCKET_ICONS: Record<TriageBucket | 'ALL', typeof Mail> = {
    ALL: Inbox,
    ACTION_REQUIRED: AlertCircle,
    APPROVAL_NEEDED: CheckCircle2,
    MEETING_SCHEDULE: Calendar,
    INVOICE: FileText,
    TASK_ASSIGNMENT: Activity,
    AWAITING_REPLY: Clock,
    FYI_ONLY: Clock,
};

export function EmailList({
    emails,
    selectedId,
    onSelectEmail,
    activeView,
    searchQuery,
    onSearchChange,
}: EmailListProps) {
    return (
        <main className="w-[420px] bg-white border-r border-slate-200 flex flex-col">
            {/* Search and Filters */}
            <div className="p-4 border-b border-slate-200 bg-white sticky top-0 z-10">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder={activeView === 'requests' ? 'Search requests...' : 'Search triage...'}
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-lg text-sm transition-all outline-none"
                    />
                </div>
                <div className="mt-3 flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 bg-white border border-slate-200 rounded-md text-xs font-medium hover:bg-slate-50">
                        <Filter size={14} /> {activeView === 'requests' ? 'Date Range' : 'Filter'}
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 bg-white border border-slate-200 rounded-md text-xs font-medium hover:bg-slate-50">
                        Sort: {activeView === 'requests' ? 'Age' : 'Priority'}
                    </button>
                </div>
            </div>

            {/* Email List */}
            <div className="flex-1 overflow-y-auto">
                {emails.map(email => {
                    const BucketIcon = BUCKET_ICONS[email.triage?.bucket || 'FYI_ONLY'] || Mail;

                    return (
                        <button
                            key={email.id}
                            onClick={() => onSelectEmail(email)}
                            className={`w-full text-left p-4 border-b border-slate-100 transition-colors relative ${selectedId === email.id ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                                }`}
                        >
                            {/* Selection indicator */}
                            {selectedId === email.id && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
                            )}

                            {/* Header: Project + Time */}
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    {email.projectName || email.projectId}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    {new Date(email.receivedDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>

                            {/* Subject */}
                            <h3 className={`text-sm font-semibold mb-1 truncate ${selectedId === email.id ? 'text-blue-900' : 'text-slate-900'
                                }`}>
                                {email.subject}
                            </h3>

                            {/* Body preview */}
                            <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                                {email.bodyPreview}
                            </p>

                            {/* Footer: Priority, Attachments, Decay/Bucket */}
                            <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-2">
                                    {/* Priority badge (only in Triage mode) */}
                                    {activeView === 'triage' && (
                                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${email.priority >= 4 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            P{email.priority}
                                        </div>
                                    )}

                                    {/* Attachment indicator */}
                                    {email.hasAttachments && (
                                        <Paperclip size={12} className="text-slate-400" />
                                    )}
                                </div>

                                {/* Decay Meter (Requests) or Bucket Icon (Triage) */}
                                {activeView === 'requests' ? (
                                    <DecayMeter timestamp={email.receivedDateTime} />
                                ) : (
                                    <BucketIcon size={14} className="text-slate-400" />
                                )}
                            </div>
                        </button>
                    );
                })}

                {emails.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                        <Mail size={32} className="opacity-40 mb-2" />
                        <p className="text-sm">No emails match your filters</p>
                    </div>
                )}
            </div>
        </main>
    );
}
