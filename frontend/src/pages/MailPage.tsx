import { useState } from 'react';
import {
  Mail,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  Circle,
  Sparkles,
  Paperclip,
  Archive,
  AlertTriangle,
  Info,
  MoreHorizontal,
} from 'lucide-react';

import {
  useInbox,
  useEnrichedInbox,
  useMailStatus,
  useArchiveEmail,
  useMarkActionRequired,
  useMarkInformational,
} from '../api/hooks/mail';
import type { ProcessedEmail, Priority, TriageStatus as TriageStatusType } from '../api/types/mail';

const ITEMS_PER_PAGE = 25;

function PriorityBadge({ priority }: { priority: Priority }) {
  const colors: Record<Priority, string> = {
    urgent: 'bg-red-200 text-red-800',
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-slate-100 text-slate-600',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[priority]}`}>
      {priority}
    </span>
  );
}

function TriageStatusIndicator({ status, confidence }: { status: TriageStatusType; confidence?: number }) {
  const config: Record<TriageStatusType, { color: string; label: string }> = {
    pending: { color: 'text-slate-400', label: 'Pending' },
    action_required: { color: 'text-red-500', label: 'Action Required' },
    informational: { color: 'text-blue-500', label: 'Info' },
    archived: { color: 'text-slate-300', label: 'Archived' },
  };

  const { color, label } = config[status] || config.pending;
  const showConfidence = confidence !== undefined && confidence > 0;

  return (
    <div className="flex items-center gap-1.5" title={`${label}${showConfidence ? ` (${Math.round(confidence * 100)}%)` : ''}`}>
      <Circle size={8} className={`${color} fill-current`} />
      {showConfidence && (
        <span className="text-[10px] text-slate-400">{Math.round(confidence * 100)}%</span>
      )}
    </div>
  );
}

function EmailActions({ email, onAction }: { email: ProcessedEmail; onAction?: () => void }) {
  const [showMenu, setShowMenu] = useState(false);
  const archiveMutation = useArchiveEmail();
  const actionRequiredMutation = useMarkActionRequired();
  const informationalMutation = useMarkInformational();

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    archiveMutation.mutate(email.id, { onSuccess: onAction });
    setShowMenu(false);
  };

  const handleMarkActionRequired = (e: React.MouseEvent) => {
    e.stopPropagation();
    actionRequiredMutation.mutate(email.id, { onSuccess: onAction });
    setShowMenu(false);
  };

  const handleMarkInformational = (e: React.MouseEvent) => {
    e.stopPropagation();
    informationalMutation.mutate(email.id, { onSuccess: onAction });
    setShowMenu(false);
  };

  const isPending = archiveMutation.isPending || actionRequiredMutation.isPending || informationalMutation.isPending;

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        disabled={isPending}
        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : <MoreHorizontal size={14} />}
      </button>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px]">
            <button
              onClick={handleMarkActionRequired}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <AlertTriangle size={14} className="text-red-500" />
              Action Required
            </button>
            <button
              onClick={handleMarkInformational}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Info size={14} className="text-blue-500" />
              Informational
            </button>
            <hr className="my-1 border-slate-100" />
            <button
              onClick={handleArchive}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Archive size={14} className="text-slate-400" />
              Archive
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function EmailRow({ email, onAction }: { email: ProcessedEmail; onAction?: () => void }) {
  const formattedDate = email.receivedAt
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(email.receivedAt)
    : '—';

  const isArchived = email.triage?.status === 'archived';

  return (
    <tr className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${isArchived ? 'opacity-50' : ''}`}>
      <td className="px-4 py-3 w-12">
        <TriageStatusIndicator
          status={email.triage?.status || 'pending'}
          confidence={email.triage?.confidence}
        />
      </td>
      <td className="px-4 py-3 w-48">
        <div className="font-medium text-slate-900 truncate">{email.senderName}</div>
        <div className="text-xs text-slate-500 truncate">{email.sender}</div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 truncate">{email.subject}</span>
          {email.hasAttachments && <Paperclip size={14} className="text-slate-400 flex-shrink-0" />}
        </div>
        <div className="text-sm text-slate-500 truncate">{email.bodyPreview}</div>
        {email.extractedKeywords.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {email.extractedKeywords.slice(0, 3).map((keyword) => (
              <span key={keyword} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded">
                {keyword}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="px-4 py-3 w-20">
        <PriorityBadge priority={email.priority} />
      </td>
      <td className="px-4 py-3 w-32 text-sm text-slate-500">{formattedDate}</td>
      <td className="px-4 py-3 w-12">
        <EmailActions email={email} onAction={onAction} />
      </td>
    </tr>
  );
}

function StatusIndicator() {
  const { data: status, isLoading, isError } = useMailStatus();

  if (isLoading) {
    return <span className="text-xs text-slate-400">Checking...</span>;
  }

  if (isError || !status) {
    return (
      <span className="flex items-center gap-1 text-xs text-red-500">
        <AlertCircle size={12} />
        Disconnected
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-1 text-xs ${status.running ? 'text-green-600' : 'text-slate-400'}`}>
      <Circle size={8} className={status.running ? 'fill-green-500' : 'fill-slate-300'} />
      {status.running ? 'Running' : 'Stopped'}
    </span>
  );
}

export function MailPage() {
  const [offset, setOffset] = useState(0);
  const [useEnrichment, setUseEnrichment] = useState(true);

  const basicQuery = useInbox({
    limit: ITEMS_PER_PAGE,
    offset,
  });

  const enrichedQuery = useEnrichedInbox({
    limit: ITEMS_PER_PAGE,
    offset,
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useEnrichment
    ? enrichedQuery
    : basicQuery;

  const totalPages = data ? Math.ceil(data.total / ITEMS_PER_PAGE) : 0;
  const currentPage = Math.floor(offset / ITEMS_PER_PAGE) + 1;

  const handlePrevPage = () => {
    setOffset(Math.max(0, offset - ITEMS_PER_PAGE));
  };

  const handleNextPage = () => {
    if (data && offset + ITEMS_PER_PAGE < data.total) {
      setOffset(offset + ITEMS_PER_PAGE);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
              <Mail className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Mail Inbox</h1>
              <StatusIndicator />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setUseEnrichment(!useEnrichment)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                useEnrichment
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title={useEnrichment ? 'AI triage enabled' : 'AI triage disabled'}
            >
              <Sparkles size={14} />
              AI Triage
            </button>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-slate-400" size={32} />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertCircle className="text-red-400 mb-3" size={40} />
            <h3 className="text-lg font-medium text-slate-900 mb-1">Failed to load emails</h3>
            <p className="text-sm text-slate-500 mb-4">
              {error instanceof Error ? error.message : 'Could not connect to AutoHelper'}
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800"
            >
              Retry
            </button>
          </div>
        ) : data?.emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Mail className="text-slate-300 mb-3" size={40} />
            <h3 className="text-lg font-medium text-slate-900 mb-1">No emails yet</h3>
            <p className="text-sm text-slate-500">Emails will appear here once ingested</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-12">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    From
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody>
                {data?.emails.map((email) => (
                  <EmailRow key={email.id} email={email} onAction={() => refetch()} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Footer / Pagination */}
      {data && data.total > ITEMS_PER_PAGE && (
        <footer className="bg-white border-t border-slate-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Showing {offset + 1}-{Math.min(offset + ITEMS_PER_PAGE, data.total)} of {data.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={offset === 0}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-slate-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={offset + ITEMS_PER_PAGE >= data.total}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
