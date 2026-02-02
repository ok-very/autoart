/**
 * IntakeEditorView - Form builder canvas with blocks
 *
 * Features:
 * - Drag-and-drop block reordering
 * - Block edit/preview modes
 * - Floating toolbar
 * - Auto-save to backend
 * - Publish with public URL
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, Eye, Send, Undo2, Redo2, Check, Loader2, ExternalLink, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@autoart/ui';
import { IntakeCanvas } from '../../workflows/intake/components/IntakeCanvas';
import { FloatingToolbar } from '../../workflows/intake/components/FloatingToolbar';
import { FormSettingsPanel } from '../../workflows/intake/components/FormSettingsPanel';
import {
    useIntakeForm,
    useUpdateIntakeForm,
    useUpsertIntakeFormPage,
} from '../../api/hooks/intake';
import type { FormBlock, ModuleBlock, ModuleBlockType } from '@autoart/shared';

interface IntakeEditorViewProps {
    formId: string;
    onBack?: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function IntakeEditorView({ formId, onBack }: IntakeEditorViewProps) {
    const navigate = useNavigate();

    // Load form from API
    const { data: form, isLoading: formLoading } = useIntakeForm(formId);
    const updateForm = useUpdateIntakeForm();
    const upsertPage = useUpsertIntakeFormPage();

    // Track user changes separately from prop values
    const [titleChanges, setTitleChanges] = useState<string | null>(null);
    const [blocksChanges, setBlocksChanges] = useState<FormBlock[] | null>(null);
    const [formDescription, setFormDescription] = useState('');
    const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [showPublishDialog, setShowPublishDialog] = useState(false);
    const [copied, setCopied] = useState(false);

    // Editor tabs
    const [activeTab, setActiveTab] = useState<'build' | 'logic' | 'settings'>('build');

    // Debounce timer refs
    const saveBlocksTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const saveTitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Track last saved blocks to avoid redundant saves
    const lastSavedBlocksRef = useRef<string>('');
    const prevFormIdRef = useRef<string | null>(null);

    // Derive form title from prop or user changes
    const formTitle = useMemo(() => {
        if (titleChanges !== null) return titleChanges;
        return form?.title ?? 'New Form';
    }, [form?.title, titleChanges]);

    // Derive blocks from prop or user changes
    const blocks = useMemo(() => {
        if (blocksChanges !== null) return blocksChanges;
        const firstPage = form?.pages?.[0];
        return firstPage?.blocks_config?.blocks ?? [];
    }, [form?.pages, blocksChanges]);

    // Reset changes when form ID changes (new form loaded)
    useEffect(() => {
        if (form && form.id !== prevFormIdRef.current) {
            prevFormIdRef.current = form.id;
            // Mark initial blocks as "saved" to avoid immediate re-save
            const firstPage = form.pages?.[0];
            if (firstPage?.blocks_config?.blocks) {
                lastSavedBlocksRef.current = JSON.stringify(firstPage.blocks_config.blocks);
            }
            // Defer state reset to avoid synchronous cascading render
            requestAnimationFrame(() => {
                setTitleChanges(null);
                setBlocksChanges(null);
            });
        }
    }, [form]);

    // Setters that track user changes
    const setFormTitle = useCallback((value: string) => setTitleChanges(value), []);
    const setBlocks = useCallback((value: FormBlock[] | ((prev: FormBlock[]) => FormBlock[])) => {
        if (typeof value === 'function') {
            // Use blocks (derived from form) as fallback when no user changes yet
            setBlocksChanges(prev => value(prev ?? blocks));
        } else {
            setBlocksChanges(value);
        }
    }, [blocks]);

    // Auto-save blocks with debounce
    useEffect(() => {
        if (!prevFormIdRef.current) return; // Don't save until form is loaded

        const blocksJson = JSON.stringify(blocks);
        // Skip if blocks haven't changed from last save
        if (blocksJson === lastSavedBlocksRef.current) return;

        if (saveBlocksTimeoutRef.current) {
            clearTimeout(saveBlocksTimeoutRef.current);
        }

        saveBlocksTimeoutRef.current = setTimeout(async () => {
            setSaveStatus('saving');
            try {
                await upsertPage.mutateAsync({
                    formId,
                    page_index: 0,
                    blocks_config: { blocks },
                });
                lastSavedBlocksRef.current = blocksJson;
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } catch (err) {
                console.error('Failed to save blocks:', err);
                setSaveStatus('error');
            }
        }, 1000);

        return () => {
            if (saveBlocksTimeoutRef.current) {
                clearTimeout(saveBlocksTimeoutRef.current);
            }
        };
    }, [blocks, formId, upsertPage]);

    // Save title changes
    const handleTitleChange = (newTitle: string) => {
        setFormTitle(newTitle);
        // Debounce title update
        if (saveTitleTimeoutRef.current) {
            clearTimeout(saveTitleTimeoutRef.current);
        }
        saveTitleTimeoutRef.current = setTimeout(() => {
            updateForm.mutate({ id: formId, title: newTitle });
        }, 1000);
    };

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigate('/intake');
        }
    };

    const handleAddBlock = useCallback((type: string) => {
        const newBlock: ModuleBlock = {
            id: crypto.randomUUID(),
            kind: 'module',
            type: type as ModuleBlockType,
            label: 'Untitled Question',
            required: false,
        };
        setBlocks((prev) => [...prev, newBlock as FormBlock]);
        setActiveBlockId(newBlock.id);
    }, [setBlocks, setActiveBlockId]);

    const handleDeleteBlock = useCallback((id: string) => {
        setBlocks((prev) => prev.filter((b) => b.id !== id));
        if (activeBlockId === id) setActiveBlockId(null);
    }, [activeBlockId, setBlocks, setActiveBlockId]);

    const handleUpdateBlock = useCallback((id: string, updates: Partial<FormBlock>) => {
        setBlocks((prev) =>
            prev.map((b) => (b.id === id ? { ...b, ...updates } as FormBlock : b))
        );
    }, [setBlocks]);

    const handleDuplicateBlock = useCallback((id: string) => {
        setBlocks((prev) => {
            const blockToDuplicate = prev.find((b) => b.id === id);
            if (!blockToDuplicate) return prev;

            const newBlock = {
                ...blockToDuplicate,
                id: crypto.randomUUID(),
                label: blockToDuplicate.kind === 'module' ? `${blockToDuplicate.label} (Copy)` : blockToDuplicate.label
            } as FormBlock;

            const index = prev.findIndex((b) => b.id === id);
            const newBlocks = [...prev];
            newBlocks.splice(index + 1, 0, newBlock);
            return newBlocks;
        });
    }, [setBlocks]);

    const handlePublish = async () => {
        // Set form status to active
        await updateForm.mutateAsync({ id: formId, status: 'active' });
        setShowPublishDialog(true);
    };

    const publicUrl = form?.unique_id
        ? `https://form.autoart.work/${form.unique_id}`
        : null;

    const handleCopyUrl = () => {
        if (publicUrl) {
            navigator.clipboard.writeText(publicUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Render save status indicator
    const renderSaveStatus = () => {
        switch (saveStatus) {
            case 'saving':
                return (
                    <span className="flex items-center gap-1 text-[10px] text-ws-muted whitespace-nowrap">
                        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                        Saving...
                    </span>
                );
            case 'saved':
                return (
                    <span className="flex items-center gap-1 text-[10px] text-green-600 whitespace-nowrap">
                        <Check className="w-3 h-3 shrink-0" />
                        Saved
                    </span>
                );
            case 'error':
                return (
                    <span className="text-[10px] text-red-500 whitespace-nowrap">Save failed</span>
                );
            default:
                return (
                    <span className="text-[10px] text-ws-muted whitespace-nowrap">All changes saved</span>
                );
        }
    };

    if (formLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Editor Header */}
            <header className="h-10 bg-ws-panel-bg border-b border-ws-panel-border flex items-center justify-between px-3 shrink-0">
                {/* Left: Back + Title */}
                <div className="flex items-center gap-4 w-1/3">
                    <button
                        onClick={handleBack}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-ws-text-secondary hover:bg-slate-100"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="flex flex-col min-w-0 overflow-hidden">
                        <input
                            type="text"
                            value={formTitle}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            className="text-sm font-semibold text-ws-fg bg-transparent border-none p-0 focus:ring-0 w-48 hover:border-b hover:border-slate-300 focus:border-b focus:border-indigo-500"
                        />
                        {renderSaveStatus()}
                    </div>
                </div>

                {/* Center: Tabs */}
                <div className="flex h-full w-1/3 justify-center">
                    {(['build', 'logic', 'settings'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 h-full flex items-center text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                                ? 'text-indigo-600 border-indigo-600'
                                : 'text-ws-text-secondary border-transparent hover:text-ws-fg'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center justify-end gap-3 w-1/3">
                    <button className="w-8 h-8 flex items-center justify-center rounded-full text-ws-text-secondary hover:bg-slate-100">
                        <Undo2 className="w-4 h-4" />
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center rounded-full text-ws-text-secondary hover:bg-slate-100">
                        <Redo2 className="w-4 h-4" />
                    </button>
                    <div className="h-6 w-px bg-slate-200 mx-1" />
                    <Button variant="ghost" size="sm" className="flex items-center gap-2">
                        <Eye className="w-4 h-4" /> Preview
                    </Button>
                    <Button
                        size="sm"
                        className="flex items-center gap-2"
                        onClick={handlePublish}
                        disabled={updateForm.isPending}
                    >
                        {updateForm.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        Publish
                    </Button>
                </div>
            </header>

            {/* Canvas Area */}
            <main className="flex-1 overflow-y-auto py-8 relative">
                {activeTab === 'build' && (
                    <div className="max-w-3xl mx-auto w-full relative min-h-[600px]">
                        {/* Floating Toolbar */}
                        <FloatingToolbar
                            activeBlockId={activeBlockId}
                            onAddBlock={handleAddBlock}
                        />

                        {/* Form Header Block */}
                        <div className="bg-ws-panel-bg rounded-xl border border-ws-panel-border mb-4 overflow-hidden border-t-4 border-t-indigo-600">
                            <div className="p-6">
                                <input
                                    type="text"
                                    value={formTitle}
                                    onChange={(e) => handleTitleChange(e.target.value)}
                                    placeholder="Form Title"
                                    className="w-full text-ws-h1 font-semibold text-ws-fg bg-transparent border-none p-0 focus:outline-none focus:ring-0"
                                />
                                <textarea
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    placeholder="Form description..."
                                    rows={2}
                                    className="w-full mt-2 text-ws-text-secondary bg-transparent border-none p-0 resize-none focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Form Blocks Canvas */}
                        <IntakeCanvas
                            blocks={blocks}
                            activeBlockId={activeBlockId}
                            onSelectBlock={setActiveBlockId}
                            onDeleteBlock={handleDeleteBlock}
                            onUpdateBlock={handleUpdateBlock}
                            onReorderBlocks={setBlocks}
                            onDuplicateBlock={handleDuplicateBlock}
                            onAddBlock={handleAddBlock}
                        />
                    </div>
                )}

                {activeTab === 'logic' && (
                    <div className="max-w-2xl mx-auto py-8 px-4">
                        <div className="flex-1" />
                    </div>
                )}

                {activeTab === 'settings' && (
                    <FormSettingsPanel
                        settings={{
                            showProgress: form?.pages?.[0]?.blocks_config?.settings?.showProgress ?? false,
                            confirmationMessage: form?.pages?.[0]?.blocks_config?.settings?.confirmationMessage,
                            redirectUrl: form?.pages?.[0]?.blocks_config?.settings?.redirectUrl,
                        }}
                        onSave={async (newSettings) => {
                            await upsertPage.mutateAsync({
                                formId,
                                page_index: 0,
                                blocks_config: {
                                    blocks,
                                    settings: newSettings,
                                },
                            });
                        }}
                        isSaving={upsertPage.isPending}
                    />
                )}
            </main>

            {/* Publish Dialog */}
            {showPublishDialog && publicUrl && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-ws-panel-bg rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
                        <h2 className="text-ws-h2 font-semibold text-ws-fg mb-2">
                            Form Published
                        </h2>
                        <p className="text-ws-text-secondary mb-4">
                            Your form is now live and accepting responses.
                        </p>

                        <div className="bg-ws-bg rounded-lg p-3 mb-4">
                            <p className="text-xs text-ws-text-secondary mb-1">Public URL</p>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={publicUrl}
                                    readOnly
                                    className="flex-1 bg-ws-panel-bg border border-ws-panel-border rounded px-3 py-2 text-sm text-ws-fg"
                                />
                                <button
                                    onClick={handleCopyUrl}
                                    className="p-2 text-ws-text-secondary hover:text-ws-text-secondary hover:bg-slate-100 rounded"
                                    title="Copy URL"
                                >
                                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                </button>
                                <a
                                    href={publicUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 text-ws-text-secondary hover:text-ws-text-secondary hover:bg-slate-100 rounded"
                                    title="Open in new tab"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button
                                variant="ghost"
                                onClick={() => setShowPublishDialog(false)}
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
