// DetailView component - Email detail with reasoning, pre-reply actions, and reply composer
// Features: Municipality selector, Stage display, Generate Draft button
// Events: Emits events aligned with autoart foundational model

import { useState, useEffect, useCallback } from 'react';
import {
    User, Tag, MoreVertical, AlertCircle, CheckCircle2,
    ArrowUpRight, MessageSquare, Mail, MapPin, Layers, Sparkles, Loader2, FolderUp
} from 'lucide-react';
import type { ProcessedEmail } from '../lib';
import { MUNICIPALITIES, PROCESS_STAGES, inferStage } from '../lib/policyMatrix';
import { AttachmentTable } from './AttachmentTable';
import {
    eventStore,
    emitEmailClassified,
    emitWorkFinished,

    emitEmailReplied,
} from '../lib/events';


interface DetailViewProps {
    email: ProcessedEmail | null;
}

export function DetailView({ email }: DetailViewProps) {
    const [checkedActions, setCheckedActions] = useState<Set<number>>(new Set());
    const [selectedMunicipality, setSelectedMunicipality] = useState<string>('');
    const [inferredStage, setInferredStage] = useState<typeof PROCESS_STAGES[0] | null>(null);
    const [generatedDraft, setGeneratedDraft] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPushingToOneDrive, setIsPushingToOneDrive] = useState(false);
    const [oneDriveStatus, setOneDriveStatus] = useState<{ type: 'success' | 'error' | 'exists' | null; message: string }>({ type: null, message: '' });
    const [selectedAttachments, setSelectedAttachments] = useState<Set<string>>(new Set());

    // Infer stage when email changes and emit classification event
    useEffect(() => {
        if (email) {
            const stage = inferStage(email.subject, email.bodyPreview || '');
            setInferredStage(stage);
            setGeneratedDraft('');
            setCheckedActions(new Set());
            setOneDriveStatus({ type: null, message: '' });
            setSelectedAttachments(new Set());

            // Emit EMAIL_CLASSIFIED event if triage data exists
            // Check if we've already classified this email in this session
            const existingClassification = eventStore.getLatestByType(email.id, 'EMAIL_CLASSIFIED');
            if (!existingClassification && email.triage) {
                emitEmailClassified(
                    email.id,
                    email.triage.bucket,
                    email.triage.confidence,
                    email.triage.reasoning
                );
            }
        }
    }, [email?.id]);

    // Toggle action completion and emit event
    const toggleAction = useCallback((index: number) => {
        if (!email) return;

        setCheckedActions(prev => {
            const next = new Set(prev);
            const wasChecked = next.has(index);

            if (wasChecked) {
                next.delete(index);
                // Note: We could emit WORK_STOPPED here, but for simplicity
                // we're treating this as just UI state toggling
            } else {
                next.add(index);
                // Emit WORK_FINISHED event when action is marked complete
                // Use a synthetic action ID based on email ID and action index
                const actionId = `${email.id}-action-${index}`;
                emitWorkFinished(email.id, 'email', actionId);
            }
            return next;
        });
    }, [email]);

    const handleGenerateDraft = async () => {
        if (!email) return;

        setIsGenerating(true);

        try {
            const response = await fetch('http://localhost:8000/api/draft/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emails: [{
                        id: email.id,
                        subject: email.subject,
                        sender: email.from,
                        senderName: email.fromName,
                        project: email.projectName || email.projectId,
                        municipality: selectedMunicipality || null,
                        stage: inferredStage?.shortName || null,
                        bodyText: email.bodyPreview || '',
                    }]
                })
            });

            if (!response.ok) throw new Error('API error');

            const result = await response.json();
            setGeneratedDraft(result.draft || 'Failed to generate draft');
        } catch (error) {
            console.error('Draft generation failed:', error);
            // Fallback to local generation
            const municipality = MUNICIPALITIES.find(m => m.id === selectedMunicipality);
            setGeneratedDraft(
                `Hi ${email.fromName?.split(' ')[0] || 'there'},\n\n` +
                `Thank you for your email regarding ${email.projectName || 'the project'}.\n\n` +
                (inferredStage ? `Regarding the ${inferredStage.shortName} stage, ` : '') +
                (municipality ? `I understand ${municipality.name}'s requirements. ` : '') +
                `I'll review this and get back to you shortly.\n\n` +
                `Best regards,\nNeal`
            );
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSendToOutlook = async () => {
        if (!email || !generatedDraft) return;

        try {
            const response = await fetch('http://localhost:8000/api/draft/send-to-outlook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: email.from,
                    subject: email.subject,
                    body: generatedDraft,
                    cc: email.cc || null,
                })
            });

            if (!response.ok) throw new Error('Failed to create draft');

            const result = await response.json();

            // Emit EMAIL_REPLIED event (draft created = reply in progress)
            emitEmailReplied(email.id, email.subject);

            alert(`✓ Draft created in Outlook: ${result.subject}`);
        } catch (error) {
            console.error('Outlook draft failed:', error);
            alert('Failed to create Outlook draft. Is the API server running?');
        }
    };

    const handlePushToOneDrive = async () => {
        if (!email) return;

        // Get selected attachments that have local paths
        const attachmentsToSend = (email.attachments || [])
            .filter(a => selectedAttachments.has(a.id) && a.localPath)
            .map(a => ({ path: a.localPath!, subfolder: null }));

        if (attachmentsToSend.length === 0) {
            setOneDriveStatus({
                type: 'error',
                message: selectedAttachments.size === 0
                    ? 'Select attachments to save'
                    : 'Selected files have no local path'
            });
            return;
        }

        setIsPushingToOneDrive(true);
        setOneDriveStatus({ type: null, message: '' });

        try {
            const response = await fetch('http://localhost:8000/api/onedrive/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    developer: email.developer || '',
                    project: email.projectName || email.projectId || 'Unknown',
                    attachments: attachmentsToSend,
                    email_date: email.receivedDateTime?.split('T')[0] || new Date().toISOString().split('T')[0],
                })
            });

            const result = await response.json();

            if (result.skipped > 0 && result.pushed === 0) {
                setOneDriveStatus({
                    type: 'exists',
                    message: `Files already exist in ${result.folder?.name || 'OneDrive'}`
                });
            } else if (result.pushed > 0) {
                const folderInfo = result.folder?.created ? ' (folder created)' : '';
                setOneDriveStatus({
                    type: 'success',
                    message: `Saved ${result.pushed} file(s) to ${result.folder?.name}${folderInfo}`
                });
            } else if (result.errors > 0) {
                setOneDriveStatus({
                    type: 'error',
                    message: `Failed to save files: ${result.details?.errors?.[0]?.error || 'Unknown error'}`
                });
            } else {
                setOneDriveStatus({
                    type: 'success',
                    message: `Resolved folder: ${result.folder?.name} (${result.folder?.method})`
                });
            }
        } catch (error) {
            console.error('OneDrive push failed:', error);
            setOneDriveStatus({
                type: 'error',
                message: 'Failed to connect to API server'
            });
        } finally {
            setIsPushingToOneDrive(false);
        }
    };

    if (!email) {
        return (
            <section className="flex-1 bg-slate-50 overflow-y-auto p-8">
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                    <Mail size={64} className="opacity-20" />
                    <p className="font-medium">Select an email to view details</p>
                </div>
            </section>
        );
    }

    const triage = email.triage;

    return (
        <section className="flex-1 bg-slate-50 overflow-y-auto p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header Card */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Email Meta Header */}
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 mb-2">{email.subject}</h2>
                                <div className="flex items-center gap-4 text-sm text-slate-600">
                                    <div className="flex items-center gap-2">
                                        <User size={16} className="text-slate-400" />
                                        <span className="font-medium text-slate-900">{email.fromName}</span>
                                        <span className="text-slate-400">&lt;{email.from}&gt;</span>
                                    </div>
                                    <span>•</span>
                                    <div className="flex items-center gap-2">
                                        <Tag size={16} className="text-slate-400" />
                                        <span>{email.projectName || email.projectId}</span>
                                    </div>
                                </div>
                            </div>
                            <button className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <MoreVertical size={20} />
                            </button>
                        </div>

                        {/* Classification badges + Municipality selector */}
                        <div className="flex flex-wrap items-center gap-2">
                            {triage && (
                                <>
                                    <div className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-semibold flex items-center gap-2 shadow-sm">
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        {triage.bucket.replace(/_/g, ' ')}
                                    </div>
                                    <div className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-semibold flex items-center gap-2 shadow-sm">
                                        <span className="text-orange-500 font-bold">!</span>
                                        Confidence: {Math.round(triage.confidence * 100)}%
                                    </div>
                                </>
                            )}
                            {inferredStage && (
                                <div className="px-3 py-1 bg-purple-50 border border-purple-200 rounded-full text-xs font-semibold text-purple-700 flex items-center gap-2">
                                    <Layers size={12} />
                                    Stage {inferredStage.id}: {inferredStage.shortName}
                                </div>
                            )}

                            {/* Municipality Selector */}
                            <div className="flex items-center gap-2 ml-auto">
                                <MapPin size={14} className="text-slate-400" />
                                <select
                                    value={selectedMunicipality}
                                    onChange={(e) => setSelectedMunicipality(e.target.value)}
                                    className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">Select Municipality...</option>
                                    {MUNICIPALITIES.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Triage Intelligence Section */}
                    {triage && (
                        <div className="grid grid-cols-3 border-b border-slate-100">
                            {/* Reasoning */}
                            <div className="p-6 border-r border-slate-100 space-y-4">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <AlertCircle size={14} /> Reasoning
                                </h4>
                                <ul className="space-y-2">
                                    {triage.reasoning.map((r, i) => (
                                        <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                                            <div className="mt-1.5 w-1 h-1 rounded-full bg-slate-300" />
                                            {r}
                                        </li>
                                    ))}
                                </ul>

                                {/* Priority Factors */}
                                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                                    <h5 className="text-[10px] font-bold text-blue-700 mb-1">Priority Factors</h5>
                                    <div className="flex flex-wrap gap-1">
                                        {email.priorityFactors.map((f, i) => (
                                            <span key={i} className="text-[10px] bg-white text-blue-800 px-1.5 py-0.5 rounded border border-blue-100">
                                                {f}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Inferred Stage Requirements */}
                                {inferredStage && (
                                    <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                                        <h5 className="text-[10px] font-bold text-purple-700 mb-1">Stage Requirements</h5>
                                        <ul className="space-y-1">
                                            {inferredStage.requiredDocuments.slice(0, 4).map((doc, i) => (
                                                <li key={i} className="text-[10px] text-purple-600">• {doc}</li>
                                            ))}
                                            {inferredStage.requiredDocuments.length > 4 && (
                                                <li className="text-[10px] text-purple-400 italic">
                                                    +{inferredStage.requiredDocuments.length - 4} more...
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* Pre-Reply Actions */}
                            <div className="col-span-2 p-6 bg-slate-50/30">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-4">
                                    <CheckCircle2 size={14} /> Recommended Pre-Reply Actions
                                </h4>
                                <div className="space-y-3">
                                    {triage.preReplyActions.length > 0 ? (
                                        triage.preReplyActions.map((action, i) => (
                                            <div
                                                key={i}
                                                onClick={() => toggleAction(i)}
                                                className={`flex items-center gap-3 p-3 bg-white border rounded-lg cursor-pointer transition-colors shadow-sm ${checkedActions.has(i)
                                                    ? 'border-emerald-300 bg-emerald-50/50'
                                                    : 'border-slate-200 hover:border-blue-300'
                                                    }`}
                                            >
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${checkedActions.has(i)
                                                    ? 'border-emerald-500 bg-emerald-500'
                                                    : 'border-slate-300 hover:border-blue-500'
                                                    }`}>
                                                    {checkedActions.has(i) && (
                                                        <CheckCircle2 size={12} className="text-white" />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <p className={`text-sm font-medium ${checkedActions.has(i) ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                                                        {action.description}
                                                    </p>
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold">{action.type}</span>
                                                </div>
                                                <ArrowUpRight size={14} className="text-slate-300" />
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-sm text-slate-500 italic">
                                            No specific pre-reply actions detected.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Email Body */}
                    <div className="p-8 bg-white min-h-[150px] prose prose-slate max-w-none">
                        <p className="whitespace-pre-line text-slate-700 leading-relaxed">
                            {email.bodyPreview || 'No preview available'}
                        </p>
                    </div>

                    {/* Attachments */}
                    {email.attachments && email.attachments.length > 0 && (
                        <div className="px-8 pb-6">
                            <AttachmentTable
                                attachments={email.attachments}
                                selectedIds={selectedAttachments}
                                onSelectionChange={setSelectedAttachments}
                            />
                        </div>
                    )}

                    {/* Reply Composer */}
                    <div className="p-6 bg-slate-50 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <MessageSquare size={16} className="text-blue-500" />
                                <span className="text-xs font-bold text-slate-700">Draft Reply</span>
                            </div>
                            <button
                                onClick={handleGenerateDraft}
                                disabled={isGenerating}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-md text-xs font-bold hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 transition-all"
                            >
                                {isGenerating ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <Sparkles size={14} />
                                )}
                                {isGenerating ? 'Generating...' : 'Generate Draft'}
                            </button>
                        </div>

                        {generatedDraft ? (
                            <div className="p-4 bg-white border border-slate-200 rounded-lg mb-4">
                                <textarea
                                    value={generatedDraft}
                                    onChange={(e) => setGeneratedDraft(e.target.value)}
                                    className="w-full text-sm text-slate-700 min-h-[120px] resize-none outline-none"
                                />
                                <div className="flex justify-end mt-2 pt-2 border-t border-slate-100">
                                    <button className="text-blue-600 font-bold text-[10px] uppercase hover:underline">
                                        Copy to Clipboard
                                    </button>
                                </div>
                            </div>
                        ) : triage?.suggestedReplyOpener ? (
                            <div className="p-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 italic relative mb-4">
                                "{triage.suggestedReplyOpener}"
                                <button className="absolute right-3 top-3 text-blue-600 font-bold text-[10px] uppercase hover:underline">
                                    Copy
                                </button>
                            </div>
                        ) : (
                            <div className="mb-4 text-xs text-slate-400 italic">
                                Click "Generate Draft" to create a reply using Gemini AI.
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={handleSendToOutlook}
                                disabled={!generatedDraft}
                                className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-shadow shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Send to Outlook Drafts
                            </button>
                            <button
                                onClick={handlePushToOneDrive}
                                disabled={isPushingToOneDrive}
                                className="flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-shadow shadow-md disabled:opacity-50"
                            >
                                {isPushingToOneDrive ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <FolderUp size={16} />
                                )}
                                {isPushingToOneDrive ? 'Saving...' : 'Save to OneDrive'}
                            </button>
                            <button className="px-6 py-3 bg-white border border-slate-200 rounded-lg font-bold text-sm hover:bg-slate-50">
                                Forward
                            </button>
                        </div>

                        {oneDriveStatus.type && (
                            <div className={`mt-3 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${oneDriveStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                oneDriveStatus.type === 'exists' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                    'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                {oneDriveStatus.type === 'success' && <CheckCircle2 size={16} />}
                                {oneDriveStatus.type === 'exists' && <AlertCircle size={16} />}
                                {oneDriveStatus.type === 'error' && <AlertCircle size={16} />}
                                {oneDriveStatus.message}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
