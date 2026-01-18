import { useState } from 'react';
import type { ProcessedEmail } from '../lib';

interface TriagePanelProps {
    email: ProcessedEmail;
}

export function TriagePanel({ email }: TriagePanelProps) {
    const [preReplyChecklist, setPreReplyChecklist] = useState<boolean[]>(
        email.triage?.preReplyActions.map(() => false) || []
    );

    const toggleAction = (index: number) => {
        setPreReplyChecklist(prev => {
            const next = [...prev];
            next[index] = !next[index];
            return next;
        });
    };

    const allPreReplyComplete = preReplyChecklist.every(Boolean);

    return (
        <div className="p-6 space-y-6">
            {/* Email header */}
            <div className="bg-slate-800 rounded-lg p-4">
                <h2 className="text-xl font-semibold text-white mb-2">{email.subject}</h2>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span>From: <span className="text-white">{email.fromName}</span></span>
                    <span>•</span>
                    <span>{new Date(email.receivedDateTime).toLocaleString()}</span>
                </div>

                {/* Metadata badges */}
                <div className="flex flex-wrap gap-2 mt-4">
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                        {email.projectId}
                    </span>
                    {email.constructionPhase && (
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                            {email.constructionPhase}
                        </span>
                    )}
                    <span className="px-2 py-1 bg-slate-600 text-slate-300 rounded text-xs">
                        {email.stakeholderType}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${email.priority >= 4 ? 'bg-red-500/20 text-red-400' : 'bg-slate-600 text-slate-300'
                        }`}>
                        Priority {email.priority}
                    </span>
                </div>
            </div>

            {/* Triage bucket */}
            {email.triage && (
                <div className="bg-slate-800 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-purple-500"></span>
                        Classification
                    </h3>
                    <div className="text-lg font-medium text-blue-400 mb-2">
                        {email.triage.bucket.replace(/_/g, ' ')}
                    </div>
                    <div className="text-sm text-slate-400">
                        Confidence: {Math.round(email.triage.confidence * 100)}%
                    </div>
                    {email.triage.reasoning.length > 0 && (
                        <ul className="mt-2 text-xs text-slate-500 space-y-1">
                            {email.triage.reasoning.map((r, i) => (
                                <li key={i}>• {r}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Pre-reply checklist */}
            {email.triage && email.triage.preReplyActions.length > 0 && (
                <div className="bg-slate-800 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                        Before Responding
                    </h3>
                    <div className="space-y-2">
                        {email.triage.preReplyActions.map((action, i) => (
                            <label
                                key={i}
                                className="flex items-center gap-3 p-2 rounded hover:bg-slate-700 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={preReplyChecklist[i] || false}
                                    onChange={() => toggleAction(i)}
                                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                    <span className="text-sm text-white">{action.description}</span>
                                    <span className="ml-2 text-xs text-slate-500">({action.type})</span>
                                </div>
                            </label>
                        ))}
                    </div>

                    {allPreReplyComplete && (
                        <div className="mt-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm">
                            ✓ All pre-reply actions complete. Ready to respond!
                        </div>
                    )}
                </div>
            )}

            {/* Post-reply tasks (to be created) */}
            {email.triage && email.triage.postReplyActions.length > 0 && (
                <div className="bg-slate-800 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                        After Responding
                    </h3>
                    <p className="text-sm text-slate-400 mb-3">
                        These tasks will be created when you reply:
                    </p>
                    <div className="space-y-2">
                        {email.triage.postReplyActions.map((action, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 bg-slate-700/50 rounded">
                                <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                                    {action.type}
                                </span>
                                <span className="text-sm text-white">{action.description}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Reply composer placeholder */}
            <div className="bg-slate-800 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    Draft Reply
                </h3>
                <textarea
                    placeholder={email.triage?.suggestedReplyOpener || 'Start typing your reply...'}
                    className="w-full h-32 bg-slate-700 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    defaultValue={email.triage?.suggestedReplyOpener}
                />
                <div className="flex justify-end gap-2 mt-3">
                    <button className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition">
                        Save Draft
                    </button>
                    <button
                        disabled={!allPreReplyComplete && (email.triage?.preReplyActions.length || 0) > 0}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Send Reply
                    </button>
                </div>
            </div>

            {/* Keywords */}
            {email.extractedKeywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {email.extractedKeywords.map(kw => (
                        <span key={kw} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                            #{kw}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
