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

import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowLeft, Eye, Send, Undo2, Redo2, Check, Loader2, ExternalLink, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@autoart/ui';
import { IntakeCanvas } from '../../components/intake/IntakeCanvas';
import { FloatingToolbar } from '../../components/intake/FloatingToolbar';
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

    // Form state
    const [formTitle, setFormTitle] = useState('New Form');
    const [formDescription, setFormDescription] = useState('');
    const [blocks, setBlocks] = useState<FormBlock[]>([]);
    const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [showPublishDialog, setShowPublishDialog] = useState(false);
    const [copied, setCopied] = useState(false);

    // Editor tabs
    const [activeTab, setActiveTab] = useState<'build' | 'logic' | 'settings'>('build');

    // Track if we've initialized from the API
    const initialized = useRef(false);

    // Debounce timer refs
    const saveBlocksTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const saveTitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize state from loaded form
    useEffect(() => {
        if (form && !initialized.current) {
            setFormTitle(form.title);
            // Load blocks from first page if exists
            const firstPage = form.pages?.[0];
            if (firstPage?.blocks_config?.blocks) {
                setBlocks(firstPage.blocks_config.blocks);
            }
            initialized.current = true;
        }
    }, [form]);

    // Debounced save function
    const saveBlocks = useCallback(async (blocksToSave: FormBlock[]) => {
        setSaveStatus('saving');
        try {
            await upsertPage.mutateAsync({
                formId,
                page_index: 0,
                blocks_config: { blocks: blocksToSave },
            });
            setSaveStatus('saved');
            // Reset to idle after showing "saved"
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (err) {
            console.error('Failed to save blocks:', err);
            setSaveStatus('error');
        }
    }, [formId, upsertPage]);

    // Auto-save blocks with debounce
    useEffect(() => {
        if (!initialized.current) return;

        if (saveBlocksTimeoutRef.current) {
            clearTimeout(saveBlocksTimeoutRef.current);
        }

        saveBlocksTimeoutRef.current = setTimeout(() => {
            saveBlocks(blocks);
        }, 1000);

        return () => {
            if (saveBlocksTimeoutRef.current) {
                clearTimeout(saveBlocksTimeoutRef.current);
            }
        };
    }, [blocks, saveBlocks]);

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
    }, []);

    const handleDeleteBlock = useCallback((id: string) => {
        setBlocks((prev) => prev.filter((b) => b.id !== id));
        if (activeBlockId === id) setActiveBlockId(null);
    }, [activeBlockId]);

    const handleUpdateBlock = useCallback((id: string, updates: Partial<FormBlock>) => {
        setBlocks((prev) =>
            prev.map((b) => (b.id === id ? { ...b, ...updates } as FormBlock : b))
        );
    }, []);

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
    }, []);

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
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Saving...
                    </span>
                );
            case 'saved':
                return (
                    <span className="flex items-center gap-1 text-[10px] text-green-600">
                        <Check className="w-3 h-3" />
                        Saved
                    </span>
                );
            case 'error':
                return (
                    <span className="text-[10px] text-red-500">Save failed</span>
                );
            default:
                return (
                    <span className="text-[10px] text-slate-400">All changes saved</span>
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
            <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
                {/* Left: Back + Title */}
                <div className="flex items-center gap-4 w-1/3">
                    <button
                        onClick={handleBack}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="flex flex-col">
                        <input
                            type="text"
                            value={formTitle}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            className="text-sm font-bold text-slate-800 bg-transparent border-none p-0 focus:ring-0 w-48 hover:border-b hover:border-slate-300 focus:border-b focus:border-indigo-500"
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
                                : 'text-slate-500 border-transparent hover:text-slate-800'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center justify-end gap-3 w-1/3">
                    <button className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
                        <Undo2 className="w-4 h-4" />
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
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
                <div className="max-w-3xl mx-auto w-full relative min-h-[600px]">
                    {/* Floating Toolbar */}
                    <FloatingToolbar
                        activeBlockId={activeBlockId}
                        onAddBlock={handleAddBlock}
                    />

                    {/* Form Header Block */}
                    <div className="bg-white rounded-xl border border-slate-200 mb-4 overflow-hidden border-t-4 border-t-indigo-600">
                        <div className="p-6">
                            <input
                                type="text"
                                value={formTitle}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                placeholder="Form Title"
                                className="w-full text-3xl font-bold text-slate-800 bg-transparent border-none p-0 focus:outline-none focus:ring-0"
                            />
                            <textarea
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                placeholder="Form description..."
                                rows={2}
                                className="w-full mt-2 text-slate-500 bg-transparent border-none p-0 resize-none focus:outline-none"
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
                    />
                </div>
            </main>

            {/* Publish Dialog */}
            {showPublishDialog && publicUrl && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
                        <h2 className="text-xl font-bold text-slate-900 mb-2">
                            Form Published
                        </h2>
                        <p className="text-slate-600 mb-4">
                            Your form is now live and accepting responses.
                        </p>

                        <div className="bg-slate-50 rounded-lg p-3 mb-4">
                            <p className="text-xs text-slate-500 mb-1">Public URL</p>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={publicUrl}
                                    readOnly
                                    className="flex-1 bg-white border border-slate-200 rounded px-3 py-2 text-sm text-slate-800"
                                />
                                <button
                                    onClick={handleCopyUrl}
                                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
                                    title="Copy URL"
                                >
                                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                </button>
                                <a
                                    href={publicUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
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
