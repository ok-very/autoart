import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Download, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';

import { Button, Badge, Spinner } from '@autoart/ui';
import { useIntakeSubmissions } from '../../../api/hooks';
import type { IntakeSubmission, CreatedRecord } from '@autoart/shared';

// ==================== TYPES ====================

interface SubmissionsTableProps {
  formId: string;
  /** Block labels for dynamic columns (blockId → label) */
  blockLabels?: Map<string, string>;
  /** Callback when clicking a created record badge */
  onRecordClick?: (recordId: string) => void;
}

// ==================== HELPERS ====================

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function exportToCSV(
  submissions: IntakeSubmission[],
  blockLabels: Map<string, string>
): void {
  // Build headers: Upload Code, Submitted At, [block labels], Created Records
  const blockIds = Array.from(blockLabels.keys());
  const headers = [
    'Upload Code',
    'Submitted At',
    ...blockIds.map((id) => blockLabels.get(id) || id),
    'Created Records',
  ];

  // Build rows
  const rows = submissions.map((sub) => {
    const metadata = sub.metadata as Record<string, unknown>;
    const createdRecords = (sub as unknown as { created_records?: CreatedRecord[] })
      .created_records;

    return [
      sub.upload_code,
      formatDate(sub.created_at),
      ...blockIds.map((id) => String(metadata[id] ?? '')),
      createdRecords?.map((r) => r.uniqueName).join('; ') || '',
    ];
  });

  // Convert to CSV string
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) => {
          // Escape quotes and wrap in quotes if contains comma/newline
          const escaped = String(cell).replace(/"/g, '""');
          return /[,\n"]/.test(escaped) ? `"${escaped}"` : escaped;
        })
        .join(',')
    ),
  ].join('\n');

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `submissions-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ==================== MAIN COMPONENT ====================

export function SubmissionsTable({
  formId,
  blockLabels = new Map(),
  onRecordClick,
}: SubmissionsTableProps) {
  const { data: submissions, isLoading, error } = useIntakeSubmissions(formId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-ws-color-error">
        Failed to load submissions
      </div>
    );
  }

  if (!submissions || submissions.length === 0) {
    return (
      <div className="text-center py-12 text-ws-text-secondary">
        No submissions yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with export */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-ws-text-secondary">
          {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => exportToCSV(submissions, blockLabels)}
        >
          <Download className="w-4 h-4 mr-1" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="border border-ws-panel-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ws-tabstrip-bg border-b border-ws-panel-border">
              <th className="w-8" /> {/* Expand toggle */}
              <th className="px-3 py-2 text-left font-medium text-ws-fg">
                Upload Code
              </th>
              <th className="px-3 py-2 text-left font-medium text-ws-fg">
                Submitted
              </th>
              <th className="px-3 py-2 text-left font-medium text-ws-fg">
                Records
              </th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((submission) => (
              <SubmissionTableRow
                key={submission.id}
                submission={submission}
                blockLabels={blockLabels}
                onRecordClick={onRecordClick}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== ROW COMPONENT ====================

interface SubmissionTableRowProps {
  submission: IntakeSubmission;
  blockLabels: Map<string, string>;
  onRecordClick?: (recordId: string) => void;
}

function SubmissionTableRow({
  submission,
  blockLabels,
  onRecordClick,
}: SubmissionTableRowProps) {
  const [expanded, setExpanded] = useState(false);

  // Extract created_records from submission (backend includes it but type might not)
  const createdRecords = useMemo(() => {
    const sub = submission as unknown as { created_records?: CreatedRecord[] };
    return sub.created_records || [];
  }, [submission]);

  const metadata = submission.metadata as Record<string, unknown>;

  return (
    <>
      <tr
        className={clsx(
          'border-b border-ws-panel-border cursor-pointer',
          'hover:bg-ws-row-expanded-bg transition-colors',
          expanded && 'bg-ws-row-expanded-bg'
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Expand toggle */}
        <td className="px-2 py-2 text-center">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-ws-muted-fg" />
          ) : (
            <ChevronRight className="w-4 h-4 text-ws-muted-fg" />
          )}
        </td>

        {/* Upload Code */}
        <td className="px-3 py-2">
          <code className="text-xs bg-ws-tabstrip-bg px-1.5 py-0.5 rounded">
            {submission.upload_code}
          </code>
        </td>

        {/* Submitted Date */}
        <td className="px-3 py-2 text-ws-text-secondary">
          {formatDate(submission.created_at)}
        </td>

        {/* Created Records */}
        <td className="px-3 py-2">
          {createdRecords.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {createdRecords.map((record) => (
                <button
                  key={record.recordId}
                  type="button"
                  className="inline-flex items-center"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    onRecordClick?.(record.recordId);
                  }}
                >
                  <Badge variant="info" className="cursor-pointer hover:opacity-80">
                    {record.uniqueName}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Badge>
                </button>
              ))}
            </div>
          ) : (
            <span className="text-ws-text-disabled">—</span>
          )}
        </td>
      </tr>

      {/* Expanded row: show all field values */}
      {expanded && (
        <tr className="bg-ws-row-expanded-bg">
          <td colSpan={4} className="px-4 py-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {Object.entries(metadata).map(([blockId, value]) => {
                // Skip internal fields (like those starting with underscore)
                if (blockId.startsWith('_')) return null;

                const label = blockLabels.get(blockId) || blockId;
                const displayValue =
                  value === null || value === undefined
                    ? '(empty)'
                    : typeof value === 'object'
                      ? JSON.stringify(value)
                      : String(value);

                return (
                  <div key={blockId} className="flex flex-col">
                    <span className="text-ws-text-secondary text-xs">
                      {label}
                    </span>
                    <span className="text-ws-fg truncate" title={displayValue}>
                      {displayValue || '(empty)'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Raw JSON fallback for debugging */}
            {Object.keys(metadata).length === 0 && (
              <pre className="text-xs text-ws-text-disabled">
                {JSON.stringify(submission.metadata, null, 2)}
              </pre>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
