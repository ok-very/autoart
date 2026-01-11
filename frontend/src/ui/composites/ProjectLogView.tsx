/**
 * ProjectLogView - Execution Log timeline for project context
 * 
 * Displays action cards with event timelines. Uses DataFieldWidget
 * for all interactive field displays. Supports drag-to-reorder within
 * timestamp buckets.
 */

import { Play, CheckCircle, HandPalm, Paperclip, Circle, PlusCircle, DotsThree } from '@phosphor-icons/react';
import { useState, useMemo } from 'react';

import { DataFieldWidget } from '../molecules/DataFieldWidget';

// Event types aligned with Action/Event architecture
export type EventType =
  | 'action_declared'
  | 'work_started'
  | 'work_finished'
  | 'blocked'
  | 'unblocked'
  | 'field_value_recorded'
  | 'evidence_attached';

export interface ExecutionEvent {
  id: string;
  type: EventType;
  bucketTime: string; // ISO timestamp floored to bucket resolution
  occurredAt: string; // ISO timestamp
  summary: string;
  detail?: string | null;
  fieldKey?: string;
  fieldValue?: unknown;
  attachmentUrl?: string;
}

export interface ActionCard {
  id: string;
  actionId: number;
  title: string;
  refCode?: string;
  assignee?: { id: number; name: string };
  status: string;
  statusConfig?: { label: string; colorClass: string };
  events: ExecutionEvent[];
  bucketRank: number; // for DnD within bucket
}

interface ProjectLogViewProps {
  projectId: string | null;
  contextType?: 'project' | 'process' | 'stage' | 'subprocess';
  contextId?: string;
}

export function ProjectLogView({ projectId }: ProjectLogViewProps) {
  const [composerDraft, setComposerDraft] = useState('');

  // TODO: Replace with API fetch + TanStack Query
  const cards: ActionCard[] = useMemo(() => {
    return [];
  }, [projectId]);

  const isLoading = false; // TODO: Get from query hook

  const handleDeclareAction = () => {
    if (!composerDraft.trim()) return;
    // TODO: Call declareAction API
    console.log('Declare:', composerDraft);
    setComposerDraft('');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-3xl mx-auto py-10 px-4 space-y-12 pb-32">
        {/* Sticky Composer */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1 flex items-center gap-2 sticky top-4 z-40 transition-shadow hover:shadow-md">
          <div className="w-10 h-10 flex items-center justify-center text-slate-400">
            <PlusCircle size={24} />
          </div>
          <input
            value={composerDraft}
            onChange={(e) => setComposerDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleDeclareAction()}
            placeholder="Declare new action..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-slate-700 placeholder-slate-400 h-10 text-sm font-medium"
          />
          <button
            onClick={handleDeclareAction}
            className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors mr-1"
          >
            Declare
          </button>
        </div>

        {/* Timeline Stream */}
        <div className="space-y-8 relative">
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-slate-200 -z-10" />

          {isLoading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-slate-200" />
                  <div className="flex-1 bg-slate-200 rounded-xl h-32" />
                </div>
              ))}
            </div>
          ) : cards.length === 0 ? (
            <div className="text-center py-16">
              <PlusCircle size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No actions declared yet</p>
              <p className="text-slate-400 text-xs mt-1">Use the composer above to declare your first action</p>
            </div>
          ) : (
            cards.map((card) => (
              <ActionCardItem key={card.id} card={card} />
            ))
          )}
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-300 pb-10">
          <div className="h-px w-10 bg-slate-200" />
          <span>End of Log</span>
          <div className="h-px w-10 bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

function ActionCardItem({ card }: { card: ActionCard }) {
  return (
    <div className="flex gap-4 group">
      {/* Icon Column */}
      <div className="flex flex-col items-center pt-1">
        <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm z-10">
          {getStatusIcon(card.status)}
        </div>
      </div>

      {/* Card Body */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-800">{card.title}</h3>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
              {card.refCode && (
                <>
                  <span className="font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                    {card.refCode}
                  </span>
                  <span>·</span>
                </>
              )}
              {card.assignee && (
                <>
                  <span>Assignee:</span>
                  <DataFieldWidget kind="user" value={card.assignee} />
                  <span>·</span>
                </>
              )}
              <DataFieldWidget
                kind="status"
                value={card.status}
                statusConfig={card.statusConfig}
                className="inline-flex"
              />
            </div>
          </div>
          <button className="text-slate-400 hover:text-slate-600 transition-colors">
            <DotsThree size={20} weight="bold" />
          </button>
        </div>

        {/* Event Timeline */}
        <div className="p-5 space-y-0 relative">
          {card.events.map((event, idx) => (
            <EventRow
              key={event.id}
              event={event}
              isLast={idx === card.events.length - 1}
            />
          ))}
        </div>

        {/* Action Bar (State Transitions) */}
        <ActionBar status={card.status} actionId={card.actionId} />
      </div>
    </div>
  );
}

function EventRow({ event, isLast }: { event: ExecutionEvent; isLast: boolean }) {
  const icon = getEventIcon(event.type);
  const colorClass = getEventColorClass(event.type);
  const time = new Date(event.occurredAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="relative pl-8 pb-6">
      {!isLast && <div className="absolute left-0 top-6 bottom-0 w-0.5 bg-slate-200" />}

      <div className={`absolute -left-1 top-0 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${colorClass}`}>
        {icon}
      </div>

      <div className="flex justify-between items-start mb-1">
        <span className={`text-xs font-medium ${getEventTextClass(event.type)}`}>
          {event.summary}
        </span>
        <span className="text-xs font-mono text-slate-400">{time}</span>
      </div>

      {event.detail && (
        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 p-2 rounded italic mt-1">
          "{event.detail}"
        </div>
      )}

      {event.type === 'field_value_recorded' && event.fieldKey && (
        <div className="bg-slate-50 border border-slate-200 rounded p-2 mt-1 inline-block">
          <span className="text-xs font-mono text-slate-600">
            {event.fieldKey} = {JSON.stringify(event.fieldValue)}
          </span>
        </div>
      )}

      {event.type === 'evidence_attached' && event.attachmentUrl && (
        <div className="flex items-center gap-2 mt-2 bg-slate-50 border border-slate-200 p-2 rounded hover:bg-white cursor-pointer transition-colors w-fit">
          <Paperclip size={14} className="text-slate-400" />
          <span className="text-xs text-blue-600 underline">
            {event.attachmentUrl.split('/').pop()}
          </span>
        </div>
      )}
    </div>
  );
}

function ActionBar({ status, actionId }: { status: string; actionId: number }) {
  const handleTransition = (transition: string) => {
    // TODO: Call transition API
    console.log('Transition:', transition, 'for action', actionId);
  };

  return (
    <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex gap-2">
      {status === 'in_progress' && (
        <>
          <button
            onClick={() => handleTransition('complete')}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 text-slate-600 px-3 py-1.5 rounded text-xs font-bold transition-all shadow-sm"
          >
            <CheckCircle size={16} /> Complete
          </button>
          <button
            onClick={() => handleTransition('block')}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:border-red-300 hover:text-red-700 text-slate-600 px-3 py-1.5 rounded text-xs font-bold transition-all shadow-sm"
          >
            <HandPalm size={16} /> Block
          </button>
        </>
      )}
      {status === 'declared' && (
        <button
          onClick={() => handleTransition('start')}
          className="flex items-center gap-2 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-700 text-slate-600 px-3 py-1.5 rounded text-xs font-bold transition-all shadow-sm"
        >
          <Play size={16} /> Start
        </button>
      )}
      <div className="h-6 w-px bg-slate-200 mx-1" />
      <button
        onClick={() => handleTransition('attach_evidence')}
        className="flex items-center gap-2 text-slate-500 hover:text-blue-600 px-2 py-1.5 rounded text-xs font-medium transition-colors"
      >
        <Paperclip size={14} /> Evidence
      </button>
    </div>
  );
}

// Helper functions
function getStatusIcon(status: string) {
  switch (status) {
    case 'in_progress': return <Play size={18} className="text-indigo-600" weight="fill" />;
    case 'done': return <CheckCircle size={18} className="text-emerald-600" weight="fill" />;
    case 'blocked': return <HandPalm size={18} className="text-red-600" weight="fill" />;
    default: return <Circle size={18} className="text-slate-400" />;
  }
}

function getEventIcon(type: EventType) {
  switch (type) {
    case 'work_started': return <Play size={10} weight="fill" />;
    case 'work_finished': return <CheckCircle size={10} weight="fill" />;
    case 'blocked': return <HandPalm size={10} weight="fill" />;
    default: return null;
  }
}

function getEventColorClass(type: EventType) {
  switch (type) {
    case 'work_started': return 'bg-indigo-100 text-indigo-600';
    case 'work_finished': return 'bg-emerald-100 text-emerald-600';
    case 'blocked': return 'bg-red-100 text-red-600';
    case 'unblocked': return 'bg-emerald-400';
    case 'field_value_recorded': return 'bg-blue-400';
    default: return 'bg-slate-200';
  }
}

function getEventTextClass(type: EventType) {
  switch (type) {
    case 'work_started': return 'text-indigo-700 font-bold';
    case 'work_finished': return 'text-emerald-700 font-bold';
    case 'blocked': return 'text-red-700 font-bold';
    case 'unblocked': return 'text-emerald-700 font-medium';
    case 'field_value_recorded': return 'text-slate-700 font-medium';
    default: return 'text-slate-700 font-medium';
  }
}
