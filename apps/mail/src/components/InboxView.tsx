import type { ProcessedEmail, ProjectGroup } from '../lib';

interface InboxViewProps {
    projectGroups: ProjectGroup[];
    selectedEmail: ProcessedEmail | null;
    onSelectEmail: (email: ProcessedEmail) => void;
}

const bucketColors: Record<string, string> = {
    ACTION_REQUIRED: 'bg-red-500/20 text-red-400',
    AWAITING_REPLY: 'bg-yellow-500/20 text-yellow-400',
    APPROVAL_NEEDED: 'bg-orange-500/20 text-orange-400',
    MEETING_SCHEDULE: 'bg-blue-500/20 text-blue-400',
    TASK_ASSIGNMENT: 'bg-purple-500/20 text-purple-400',
    INVOICE: 'bg-green-500/20 text-green-400',
    FYI_ONLY: 'bg-slate-500/20 text-slate-400',
};

const priorityColors: Record<number, string> = {
    5: 'bg-red-500',
    4: 'bg-orange-500',
    3: 'bg-yellow-500',
    2: 'bg-blue-500',
    1: 'bg-slate-500',
};

export function InboxView({ projectGroups, selectedEmail, onSelectEmail }: InboxViewProps) {
    return (
        <div className="p-4 space-y-6">
            {projectGroups.map(group => (
                <div key={group.projectId} className="bg-slate-800 rounded-lg overflow-hidden">
                    {/* Project header */}
                    <div className="px-4 py-3 bg-slate-700 flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-white">{group.projectId}</h3>
                            <p className="text-sm text-slate-400">
                                {group.emails.length} email{group.emails.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                        {group.highPriorityCount > 0 && (
                            <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                                {group.highPriorityCount} high priority
                            </span>
                        )}
                    </div>

                    {/* Email list */}
                    <div className="divide-y divide-slate-700">
                        {group.emails.map(email => (
                            <div
                                key={email.id}
                                onClick={() => onSelectEmail(email)}
                                className={`px-4 py-3 cursor-pointer transition-all hover:bg-slate-700 ${selectedEmail?.id === email.id ? 'bg-slate-700 border-l-4 border-blue-500' : ''
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Priority indicator */}
                                    <div className={`w-2 h-2 mt-2 rounded-full ${priorityColors[email.priority] || 'bg-slate-500'}`} />

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-white font-medium truncate">{email.fromName}</span>
                                            {email.hasAttachments && (
                                                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                </svg>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-300 truncate">{email.subject}</p>
                                        <p className="text-xs text-slate-500 truncate mt-1">{email.bodyPreview}</p>

                                        {/* Triage badge */}
                                        {email.triage && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-xs ${bucketColors[email.triage.bucket] || ''}`}>
                                                    {email.triage.bucket.replace(/_/g, ' ')}
                                                </span>
                                                {email.triage.preReplyActions.length > 0 && (
                                                    <span className="text-xs text-slate-400">
                                                        {email.triage.preReplyActions.length} action{email.triage.preReplyActions.length !== 1 ? 's' : ''} needed
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Timestamp */}
                                    <span className="text-xs text-slate-500 whitespace-nowrap">
                                        {new Date(email.receivedDateTime).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {projectGroups.length === 0 && (
                <div className="text-center text-slate-500 py-12">
                    No emails match the current filter
                </div>
            )}
        </div>
    );
}
