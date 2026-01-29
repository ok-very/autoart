import { Plus, Trash2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';

import { useCreateFinanceRecord, useCreateFinanceLink, useUpdateFinanceRecord } from '../../api/hooks/finance';
import { useRecordDefinitions } from '../../api/hooks/definitions';
import { useDeleteRecord } from '../../api/hooks/records';
import { formatCurrency } from '@autoart/shared';
import { Button } from '@autoart/ui';
import type { DataRecord } from '../../types';

interface LineItemEditorProps {
  invoiceId: string;
  lineItems: DataRecord[];
  currency: string;
}

interface LineItemRow {
  id: string;
  description: string;
  itemType: string;
  qty: number;
  unitPrice: number; // cents
  vatRate: number;
  lineTotal: number | null; // cents, computed
  lineTax: number | null; // cents, computed
}

function parseLineItem(record: DataRecord): LineItemRow {
  const data = record.data as Record<string, unknown>;
  const unitPrice = data.unit_price as { amount: number } | number | undefined;
  return {
    id: record.id,
    description: (data.description as string) || '',
    itemType: (data.item_type as string) || 'Service',
    qty: (data.qty as number) || 0,
    unitPrice: typeof unitPrice === 'object' ? unitPrice.amount : (unitPrice as number) ?? 0,
    vatRate: (data.vat_rate as number) || 0,
    lineTotal: (data.line_total as number) ?? null,
    lineTax: (data.line_tax as number) ?? null,
  };
}

export function LineItemEditor({ invoiceId, lineItems, currency }: LineItemEditorProps) {
  const { data: definitions = [] } = useRecordDefinitions();
  const lineItemDef = useMemo(
    () => definitions.find((d) => d.name === 'Invoice Line Item'),
    [definitions],
  );

  const createRecord = useCreateFinanceRecord();
  const createLink = useCreateFinanceLink();
  const updateRecord = useUpdateFinanceRecord();
  const deleteRecord = useDeleteRecord();

  const items = useMemo(() => lineItems.map(parseLineItem), [lineItems]);

  const handleAddLine = useCallback(async () => {
    if (!lineItemDef) return;

    const result = await createRecord.mutateAsync({
      definitionId: lineItemDef.id,
      uniqueName: `Line ${items.length + 1}`,
      data: {
        description: '',
        item_type: 'Service',
        qty: 1,
        unit_price: { amount: 0, currency },
        vat_rate: 0,
      },
    });

    await createLink.mutateAsync({
      sourceRecordId: invoiceId,
      targetRecordId: result.record.id,
      linkType: 'line_item',
    });
  }, [lineItemDef, items.length, currency, invoiceId, createRecord, createLink]);

  const handleFieldChange = useCallback(
    (itemId: string, field: string, value: unknown) => {
      const item = lineItems.find((li) => li.id === itemId);
      if (!item) return;
      const data = { ...(item.data as Record<string, unknown>), [field]: value };
      updateRecord.mutate({ id: itemId, data });
    },
    [lineItems, updateRecord],
  );

  const handleDelete = useCallback(
    (itemId: string) => deleteRecord.mutate(itemId),
    [deleteRecord],
  );

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-left">
            <th className="px-3 py-2 font-medium text-slate-500 text-xs">Description</th>
            <th className="px-3 py-2 font-medium text-slate-500 text-xs w-20">Type</th>
            <th className="px-3 py-2 font-medium text-slate-500 text-xs w-16 text-right">Qty</th>
            <th className="px-3 py-2 font-medium text-slate-500 text-xs w-28 text-right">Unit Price</th>
            <th className="px-3 py-2 font-medium text-slate-500 text-xs w-16 text-right">Tax %</th>
            <th className="px-3 py-2 font-medium text-slate-500 text-xs w-28 text-right">Total</th>
            <th className="px-3 py-2 w-8" />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-4 text-center text-slate-400 text-xs">
                No line items
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id} className="border-b border-slate-50">
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => handleFieldChange(item.id, 'description', e.target.value)}
                    className="w-full bg-transparent text-sm text-slate-700 outline-none focus:bg-slate-50 px-1 py-0.5 rounded"
                    placeholder="Description"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <select
                    value={item.itemType}
                    onChange={(e) => handleFieldChange(item.id, 'item_type', e.target.value)}
                    className="bg-transparent text-xs text-slate-600 outline-none"
                  >
                    {['Service', 'Material', 'Expense', 'Honorarium', 'Other'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <input
                    type="number"
                    value={item.qty}
                    onChange={(e) => handleFieldChange(item.id, 'qty', Number(e.target.value))}
                    className="w-full bg-transparent text-sm text-slate-700 text-right outline-none focus:bg-slate-50 px-1 py-0.5 rounded"
                    min={0}
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <input
                    type="text"
                    value={(item.unitPrice / 100).toFixed(2)}
                    onChange={(e) => {
                      const cents = Math.round(parseFloat(e.target.value || '0') * 100);
                      handleFieldChange(item.id, 'unit_price', { amount: cents, currency });
                    }}
                    className="w-full bg-transparent text-sm font-mono text-slate-700 text-right outline-none focus:bg-slate-50 px-1 py-0.5 rounded"
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <input
                    type="number"
                    value={item.vatRate}
                    onChange={(e) => handleFieldChange(item.id, 'vat_rate', Number(e.target.value))}
                    className="w-full bg-transparent text-sm text-slate-700 text-right outline-none focus:bg-slate-50 px-1 py-0.5 rounded"
                    min={0}
                    max={100}
                  />
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-slate-700">
                  {item.lineTotal !== null
                    ? formatCurrency({ amount: item.lineTotal, currency })
                    : '\u2014'}
                </td>
                <td className="px-1 py-1.5">
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="px-3 py-2 bg-slate-50 border-t border-slate-200">
        <Button
          variant="ghost"
          size="xs"
          leftSection={<Plus size={12} />}
          onClick={handleAddLine}
          disabled={!lineItemDef}
        >
          Add line item
        </Button>
      </div>
    </div>
  );
}
