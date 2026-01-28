/**
 * ExportRecordsDialog Component
 *
 * Modal dialog for exporting tearsheet artworks to the records database.
 * Allows definition selection and shows export preview.
 */

import { useState, useMemo } from 'react';
import { Stack, Text, Button, Inline, Select, Badge } from '@autoart/ui';
import { FileText, AlertTriangle, Check, X } from 'lucide-react';
import { useRecordDefinitions } from '../../../api/hooks/definitions';
import { useBulkImportRecords } from '../../../api/hooks/records';
import type { ExportPayload } from '../utils/tearsheetExport';
import { getExportSummary, toBulkImportFormat } from '../utils/tearsheetExport';

export interface ExportRecordsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  exportPayload: ExportPayload;
  onSuccess: (result: { created: number; updated: number }) => void;
}

export function ExportRecordsDialog({
  isOpen,
  onClose,
  exportPayload,
  onSuccess,
}: ExportRecordsDialogProps) {
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string>('');
  const { data: definitions, isLoading: loadingDefinitions } = useRecordDefinitions();
  const bulkImport = useBulkImportRecords();

  // Filter to record-type definitions only
  const recordDefinitions = useMemo(() => {
    return definitions?.filter((d) => (d as { definition_kind?: string }).definition_kind === 'record') ?? [];
  }, [definitions]);

  const artworks = useMemo(() => exportPayload.artworks ?? [], [exportPayload.artworks]);
  const summary = getExportSummary(exportPayload);
  const hasDuplicateSlugs = useMemo(() => {
    const slugs = artworks.map((a) => a.slug);
    return new Set(slugs).size < slugs.length;
  }, [artworks]);

  const handleExport = async () => {
    if (!selectedDefinitionId) return;

    const payload = toBulkImportFormat(exportPayload, selectedDefinitionId);

    try {
      const result = await bulkImport.mutateAsync(payload);
      onSuccess({ created: result.created, updated: result.updated });
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <Inline gap="sm" align="center">
            <FileText className="w-5 h-5 text-blue-600" />
            <Text size="lg" weight="bold">
              Export to Records
            </Text>
          </Inline>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <Stack gap="md">
            {/* Summary */}
            <div className="bg-slate-50 rounded-lg p-4">
              <Text size="sm" color="muted" className="mb-1">
                Export Summary
              </Text>
              <Text weight="medium">{summary}</Text>
              {hasDuplicateSlugs && (
                <Inline gap="xs" align="center" className="mt-2 text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  <Text size="sm">
                    Records with duplicate slugs will be updated, not duplicated
                  </Text>
                </Inline>
              )}
            </div>

            {/* Definition Selection */}
            <div>
              <Text size="sm" weight="medium" className="mb-2">
                Target Definition
              </Text>
              {loadingDefinitions ? (
                <Text size="sm" color="muted">
                  Loading definitions...
                </Text>
              ) : recordDefinitions.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <Inline gap="sm" align="center">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <Text size="sm" className="text-amber-800">
                      No record definitions available. Create one first.
                    </Text>
                  </Inline>
                </div>
              ) : (
                <Select
                  value={selectedDefinitionId || null}
                  onChange={(value) => setSelectedDefinitionId(value || '')}
                  data={recordDefinitions.map((def) => ({
                    value: def.id,
                    label: def.name,
                  }))}
                  placeholder="Select a definition..."
                  className="w-full"
                />
              )}
            </div>

            {/* Preview */}
            {artworks.length > 0 && (
              <div>
                <Text size="sm" weight="medium" className="mb-2">
                  Artworks Preview
                </Text>
                <div className="border border-slate-200 rounded-lg max-h-48 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">
                          Slug
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">
                          Title
                        </th>
                        <th className="px-3 py-2 text-center font-medium text-slate-600">
                          Page
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {artworks.slice(0, 10).map((artwork) => (
                        <tr key={artwork.refId} className="hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                              {artwork.slug}
                            </code>
                          </td>
                          <td className="px-3 py-2 truncate max-w-[150px]">
                            {artwork.title}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant="default" size="sm">
                              {artwork.pageNumber}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      {artworks.length > 10 && (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-3 py-2 text-center text-slate-500"
                          >
                            ...and {artworks.length - 10} more
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Error */}
            {bulkImport.isError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <Inline gap="sm" align="center">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <Text size="sm" className="text-red-800">
                    Export failed. Please try again.
                  </Text>
                </Inline>
              </div>
            )}
          </Stack>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-lg">
          <Inline justify="end" gap="sm">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={
                !selectedDefinitionId ||
                bulkImport.isPending ||
                artworks.length === 0
              }
            >
              {bulkImport.isPending ? (
                'Exporting...'
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Export {artworks.length} Records
                </>
              )}
            </Button>
          </Inline>
        </div>
      </div>
    </div>
  );
}
