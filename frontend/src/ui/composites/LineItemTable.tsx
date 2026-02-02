/**
 * LineItemTable
 *
 * Editable table for invoice/quote line items.
 * Supports add/remove rows, inline editing, and auto-calculated amounts.
 */

import { useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { formatCurrency } from '@autoart/shared';

export interface LineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
}

interface LineItemTableProps {
    items: LineItem[];
    onChange: (items: LineItem[]) => void;
    currency: string;
    disabled?: boolean;
}

function generateId(): string {
    return crypto.randomUUID();
}

export function LineItemTable({ items, onChange, currency, disabled }: LineItemTableProps) {
    const handleAddRow = useCallback(() => {
        onChange([
            ...items,
            { id: generateId(), description: '', quantity: 1, unitPrice: 0 },
        ]);
    }, [items, onChange]);

    const handleRemoveRow = useCallback(
        (id: string) => {
            onChange(items.filter((item) => item.id !== id));
        },
        [items, onChange],
    );

    const handleUpdateRow = useCallback(
        (id: string, field: keyof LineItem, value: string | number) => {
            onChange(
                items.map((item) =>
                    item.id === id ? { ...item, [field]: value } : item,
                ),
            );
        },
        [items, onChange],
    );

    return (
        <div className="border border-[var(--ws-panel-border,#e2e8f0)] rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_80px_120px_100px_40px] bg-[var(--ws-panel-bg,#f8fafc)] border-b border-[var(--ws-panel-border,#e2e8f0)] text-xs font-medium text-[var(--ws-text-secondary,#5a5a57)]">
                <div className="px-3 py-2">Description</div>
                <div className="px-3 py-2 text-center">Qty</div>
                <div className="px-3 py-2 text-right">Unit Price</div>
                <div className="px-3 py-2 text-right">Amount</div>
                <div className="px-3 py-2"></div>
            </div>

            {/* Rows */}
            {items.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-[var(--ws-muted,#94a3b8)]">
                    No line items. Click "+ Add" to add one.
                </div>
            ) : (
                items.map((item) => {
                    const amount = item.quantity * item.unitPrice;
                    return (
                        <div
                            key={item.id}
                            className="grid grid-cols-[1fr_80px_120px_100px_40px] border-b border-[var(--ws-panel-border,#e2e8f0)] last:border-b-0"
                        >
                            {/* Description */}
                            <div className="px-2 py-1.5">
                                <input
                                    type="text"
                                    value={item.description}
                                    onChange={(e) => handleUpdateRow(item.id, 'description', e.target.value)}
                                    placeholder="Line item description"
                                    disabled={disabled}
                                    className={clsx(
                                        'w-full px-2 py-1 text-sm rounded border-0 bg-transparent',
                                        'focus:outline-none focus:ring-1 focus:ring-[var(--ws-accent,#3b82f6)]',
                                        'placeholder:text-[var(--ws-muted,#94a3b8)]',
                                    )}
                                />
                            </div>

                            {/* Quantity */}
                            <div className="px-2 py-1.5">
                                <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={item.quantity}
                                    onChange={(e) => handleUpdateRow(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                    disabled={disabled}
                                    className={clsx(
                                        'w-full px-2 py-1 text-sm text-center rounded border-0 bg-transparent',
                                        'focus:outline-none focus:ring-1 focus:ring-[var(--ws-accent,#3b82f6)]',
                                    )}
                                />
                            </div>

                            {/* Unit Price */}
                            <div className="px-2 py-1.5">
                                <input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={item.unitPrice}
                                    onChange={(e) => handleUpdateRow(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                    disabled={disabled}
                                    className={clsx(
                                        'w-full px-2 py-1 text-sm text-right font-mono rounded border-0 bg-transparent',
                                        'focus:outline-none focus:ring-1 focus:ring-[var(--ws-accent,#3b82f6)]',
                                    )}
                                />
                            </div>

                            {/* Computed Amount */}
                            <div className="px-3 py-2 text-sm text-right font-mono text-[var(--ws-text-secondary,#5a5a57)]">
                                {formatCurrency({ amount, currency })}
                            </div>

                            {/* Delete button */}
                            <div className="px-2 py-1.5 flex items-center justify-center">
                                <button
                                    type="button"
                                    onClick={() => handleRemoveRow(item.id)}
                                    disabled={disabled}
                                    className={clsx(
                                        'p-1 rounded hover:bg-[var(--ws-bg,#f8fafc)] text-[var(--ws-muted,#94a3b8)]',
                                        'hover:text-[var(--ws-color-error,#8c4a4a)] transition-colors',
                                        'disabled:opacity-50 disabled:cursor-not-allowed',
                                    )}
                                    aria-label="Remove line item"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    );
                })
            )}

            {/* Add Row Footer */}
            <div className="px-3 py-2 border-t border-[var(--ws-panel-border,#e2e8f0)] bg-[var(--ws-panel-bg,#f8fafc)]">
                <button
                    type="button"
                    onClick={handleAddRow}
                    disabled={disabled}
                    className={clsx(
                        'flex items-center gap-1.5 text-sm font-medium',
                        'text-[var(--ws-accent,#3b82f6)] hover:text-[var(--ws-accent-hover,#2563eb)]',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                >
                    <Plus size={14} />
                    Add Line Item
                </button>
            </div>
        </div>
    );
}
