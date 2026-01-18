import { useState } from 'react';
import { Mail, RefreshCw, ChevronLeft, ChevronRight, AlertCircle, Loader2, Circle } from 'lucide-react';

import { useInbox, useMailStatus } from '../api/hooks/mail';
import type { ProcessedEmail } from '../api/types/mail';

const ITEMS_PER_PAGE = 25;

function PriorityBadge({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  const colors = {
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

function TriageStatus({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'text-slate-400',
    actionRequired: 'text-red-500',
    informational: 'text-blue-500',
    archived: 'text-slate-300',
  };

  return <Circle size={8} className={`${colors[status] || colors.pending} fill-current`} />;
}

function EmailRow({ email }: { email: ProcessedEmail }) {
  const formattedDate = email.receivedAt
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(email.receivedAt)
    : '—';

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
      <td className="px-4 py-3 w-8">
        <TriageStatus status={email.triage?.status || 'pending'} />
      </td>
      <td className="px-4 py-3 w-48">
        <div className="font-medium text-slate-900 truncate">{email.senderName}</div>
        <div className="text-xs text-slate-500 truncate">{email.sender}</div>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900 truncate">{email.subject}</div>
        <div className="text-sm text-slate-500 truncate">{email.bodyPreview}</div>
      </td>
      <td className="px-4 py-3 w-20">
        <PriorityBadge priority={email.priority} />
      </td>
      <td className="px-4 py-3 w-32 text-sm text-slate-500">{formattedDate}</td>
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
  const { data, isLoading, isError, error, refetch, isFetching } = useInbox({
    limit: ITEMS_PER_PAGE,
    offset,
  });

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
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-8" />
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
                </tr>
              </thead>
              <tbody>
                {data?.emails.map((email) => (
                  <EmailRow key={email.id} email={email} />
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
