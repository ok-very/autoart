import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useProjectTree } from '../../api/hooks';
import { useHierarchyStore } from '../../stores/hierarchyStore';
import { useUIStore } from '../../stores/uiStore';
import type { HierarchyNode } from '../../types';
import { parseTaskMetadata, deriveTaskStatus, type TaskStatus } from '../../utils/nodeMetadata';

interface CalendarTask {
  id: string;
  title: string;
  dueDate: string;
  status: TaskStatus;
  subprocessTitle: string;
}

function getNodeMetadata(node: HierarchyNode): Record<string, unknown> {
  if (typeof node.metadata === 'string') {
    try {
      const parsed = JSON.parse(node.metadata);
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return (node.metadata as Record<string, unknown>) || {};
}

function collectAllTasks(
  project: HierarchyNode,
  getChildren: (id: string | null) => HierarchyNode[]
): CalendarTask[] {
  const tasks: CalendarTask[] = [];
  const processes = getChildren(project.id);

  for (const process of processes) {
    const stages = getChildren(process.id);
    for (const stage of stages) {
      const subprocesses = getChildren(stage.id).filter((n) => n.type === 'subprocess');
      for (const subprocess of subprocesses) {
        const subTasks = getChildren(subprocess.id).filter((n) => n.type === 'task');
        for (const task of subTasks) {
          const raw = getNodeMetadata(task);
          const meta = parseTaskMetadata(raw);
          const dueDate = (meta.dueDate || '') as string;

          if (dueDate) {
            tasks.push({
              id: task.id,
              title: task.title,
              dueDate,
              status: deriveTaskStatus(meta),
              subprocessTitle: subprocess.title,
            });
          }
        }
      }
    }
  }

  return tasks;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_COLORS: Record<TaskStatus, string> = {
  'empty': 'bg-slate-100 border-slate-300 text-slate-600',
  'not-started': 'bg-slate-100 border-slate-300 text-slate-600',
  'in-progress': 'bg-amber-100 border-amber-300 text-amber-800',
  'blocked': 'bg-red-100 border-red-300 text-red-800',
  'review': 'bg-purple-100 border-purple-300 text-purple-800',
  'done': 'bg-emerald-100 border-emerald-300 text-emerald-800',
};

export function CalendarView() {
  const { setNodes, getNode, getChildren } = useHierarchyStore();
  const { activeProjectId, inspectNode } = useUIStore();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const { data: nodes } = useProjectTree(activeProjectId);
  useEffect(() => {
    if (nodes) setNodes(nodes);
  }, [nodes, setNodes]);

  const project = activeProjectId ? getNode(activeProjectId) : null;

  const tasks = useMemo(() => {
    if (!project) return [];
    return collectAllTasks(project, getChildren);
  }, [project, getChildren]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    for (const task of tasks) {
      // Parse various date formats
      const dateStr = task.dueDate.split('T')[0]; // Handle ISO format
      if (!map.has(dateStr)) {
        map.set(dateStr, []);
      }
      map.get(dateStr)!.push(task);
    }
    return map;
  }, [tasks]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  if (!activeProjectId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400">
        <div className="text-center">
          <p className="text-lg font-medium">No project selected</p>
          <p className="text-sm">Select a project from the top menu</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400">
        <div className="text-center">
          <p className="text-lg font-medium">Loading project...</p>
        </div>
      </div>
    );
  }

  // Build calendar grid
  const calendarDays: (number | null)[] = [];
  // Leading empty cells
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }
  // Trailing empty cells to complete the grid
  while (calendarDays.length % 7 !== 0) {
    calendarDays.push(null);
  }

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Calendar Header */}
      <div className="h-14 border-b border-slate-200 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-slate-800">
            {MONTH_NAMES[month]} {year}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-slate-100 rounded transition-colors"
              title="Previous month"
            >
              <ChevronLeft size={18} className="text-slate-600" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-slate-100 rounded transition-colors"
              title="Next month"
            >
              <ChevronRight size={18} className="text-slate-600" />
            </button>
          </div>
          <button
            onClick={goToToday}
            className="text-xs px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-600"
          >
            Today
          </button>
        </div>
        <div className="text-sm text-slate-500">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} with due dates
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="min-h-full">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 mb-1">
            {DAY_NAMES.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7 auto-rows-fr" style={{ minHeight: 'calc(100% - 40px)' }}>
            {calendarDays.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="bg-slate-50 border border-slate-100" />;
              }

              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayTasks = tasksByDate.get(dateStr) || [];
              const isTodayCell = isToday(day);

              return (
                <div
                  key={dateStr}
                  className={`border border-slate-100 p-1 min-h-[100px] ${isTodayCell ? 'bg-blue-50' : 'bg-white'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isTodayCell
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600'
                        }`}
                    >
                      {day}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="text-[10px] text-slate-400">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5 overflow-y-auto max-h-[80px]">
                    {dayTasks.slice(0, 3).map((task) => (
                      <button
                        key={task.id}
                        onClick={() => inspectNode(task.id)}
                        className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] truncate border ${STATUS_COLORS[task.status]
                          } hover:brightness-95 transition-all`}
                        title={`${task.title} (${task.subprocessTitle})`}
                      >
                        {task.title}
                      </button>
                    ))}
                    {dayTasks.length > 3 && (
                      <div className="text-[10px] text-slate-400 px-1">
                        +{dayTasks.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
