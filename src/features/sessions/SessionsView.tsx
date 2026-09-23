import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Session, Task, Roadmap } from '../../domain';
import { SessionHistoryFilter, SessionHistoryResult } from '../../application';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { ActiveSessionTimer } from './ActiveSessionTimer';
import { ManualSessionModal } from './ManualSessionModal';
import { groupSessionsByDay } from './sessionGrouping';
import { useUserPreferences, getTranslation } from '../../app/preferences';
import {
  Clock,
  Calendar,
  CheckCircle2,
  Filter,
  Plus,
  RotateCcw,
  Layers,
  CheckSquare,
  Sparkles,
} from 'lucide-react';

export const SessionsView: React.FC = () => {
  const application = useApplication();
  const { formatDate, formatTime, formatNumeral, formatDurationHoursMinutes, preferences } = useUserPreferences();
  const t = (key: Parameters<typeof getTranslation>[0]) => getTranslation(key, preferences.language);

  // Data state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tasksMap, setTasksMap] = useState<Record<string, Task>>({});
  const [roadmapsMap, setRoadmapsMap] = useState<Record<string, Roadmap>>({});
  const [availableRoadmaps, setAvailableRoadmaps] = useState<Roadmap[]>([]);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [totalDatabaseSessionsCount, setTotalDatabaseSessionsCount] = useState<number>(0);
  const [totalDatabaseMinutes, setTotalDatabaseMinutes] = useState<number>(0);

  const [historyResult, setHistoryResult] = useState<SessionHistoryResult>({
    sessions: [],
    totalSessions: 0,
    totalMinutes: 0,
    totalHoursAndMinutes: { hours: 0, minutes: 0 },
  });

  // Filter state
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterTaskId, setFilterTaskId] = useState<string>('');
  const [filterRoadmapId, setFilterRoadmapId] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);

  const hasActiveFilters = Boolean(
    filterStartDate || filterEndDate || filterTaskId || filterRoadmapId
  );

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      const filter: SessionHistoryFilter = {
        ...(filterStartDate ? { startDate: filterStartDate } : {}),
        ...(filterEndDate ? { endDate: filterEndDate } : {}),
        ...(filterTaskId ? { taskId: filterTaskId } : {}),
        ...(filterRoadmapId ? { roadmapId: filterRoadmapId } : {}),
      };

      const [filteredHistory, allRoadmaps, allTasks, allSessions] = await Promise.all([
        application.sessions.querySessionHistory(filter),
        application.roadmaps.listRoadmaps(),
        application.tasks.listTasks(),
        application.sessions.getAllSessions(),
      ]);

      const tMap: Record<string, Task> = {};
      allTasks.forEach((task) => {
        tMap[task.id] = task;
      });
      setTasksMap(tMap);

      const rMap: Record<string, Roadmap> = {};
      allRoadmaps.forEach((roadmap) => {
        rMap[roadmap.id] = roadmap;
      });
      setRoadmapsMap(rMap);

      setAvailableRoadmaps(allRoadmaps);
      setAvailableTasks(allTasks);

      setHistoryResult(filteredHistory);
      setSessions([...filteredHistory.sessions]);

      setTotalDatabaseSessionsCount(allSessions.length);
      setTotalDatabaseMinutes(allSessions.reduce((acc, s) => acc + s.durationMinutes, 0));
    } catch (err) {
      console.error('Failed to load sessions data', err);
    } finally {
      setIsLoading(false);
    }
  }, [application, filterStartDate, filterEndDate, filterTaskId, filterRoadmapId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle coherent Roadmap & Task dropdown adjustments
  const handleRoadmapChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRoadmapId = e.target.value;
    setFilterRoadmapId(newRoadmapId);
    if (newRoadmapId && filterTaskId) {
      const currentTask = tasksMap[filterTaskId];
      if (currentTask && currentTask.roadmapId !== newRoadmapId) {
        setFilterTaskId('');
      }
    }
  };

  const handleTaskChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTaskId = e.target.value;
    setFilterTaskId(newTaskId);
    if (newTaskId) {
      const task = tasksMap[newTaskId];
      if (task && (!filterRoadmapId || filterRoadmapId !== task.roadmapId)) {
        setFilterRoadmapId(task.roadmapId);
      }
    }
  };

  const handleClearFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterTaskId('');
    setFilterRoadmapId('');
  };

  const selectableTasks = filterRoadmapId
    ? availableTasks.filter((t) => t.roadmapId === filterRoadmapId)
    : availableTasks;

  // Derive Daily Groups (Phase 9C-2)
  const dayGroups = useMemo(() => {
    return groupSessionsByDay(sessions, preferences);
  }, [sessions, preferences]);

  const formattedHoursAndMinutes = () => {
    return formatDurationHoursMinutes(historyResult.totalMinutes);
  };

  return (
    <div id="sessions-view" className="max-w-5xl mx-auto space-y-8">
      {/* Header & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Phase 9C-1: History & Filtering
            </span>
            <span className="text-xs text-neutral-500">Live Execution</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
            Work Sessions & Time Tracking
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 max-w-2xl">
            Execute focused blocks of deep work against actionable tasks. The timer counts upward offline and persists immutable historical sessions.
          </p>
        </div>

        {/* Actions & Global Database Stats */}
        <div className="flex items-center gap-3 self-start sm:self-center flex-wrap">
          <button
            id="btn-open-manual-session-modal"
            onClick={() => setIsManualModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 text-xs font-semibold cursor-pointer transition shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('logManualSession')}</span>
          </button>

          <div className="px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs text-left">
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 font-semibold block">
              {t('totalRecorded')}
            </span>
            <div className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              {formatNumeral(totalDatabaseMinutes)}{preferences.language === 'fa' ? ' دقیقه' : 'm'}{' '}
              <span className="text-xs font-normal text-neutral-500">
                ({formatNumeral(totalDatabaseSessionsCount)} {preferences.language === 'fa' ? 'جلسه' : totalDatabaseSessionsCount === 1 ? 'session' : 'sessions'})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Session / Timer Component */}
      <section aria-labelledby="active-session-heading">
        <h2 id="active-session-heading" className="sr-only">
          Active Session Timer
        </h2>
        <ActiveSessionTimer onSessionCompleted={loadData} />
      </section>

      {/* Historical Completed Sessions */}
      <section className="space-y-4" aria-labelledby="session-history-heading">
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-neutral-500" />
            <h2 id="session-history-heading" className="text-sm font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              {t('sessionHistory')}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              id="btn-log-session-inline"
              onClick={() => setIsManualModalOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>{t('logManualSession')}</span>
            </button>
            <span className="text-xs font-mono text-neutral-500">
              {formatNumeral(sessions.length)} {preferences.language === 'fa' ? 'جلسه' : 'logged'}
            </span>
          </div>
        </div>

        {/* Compact Filter Area */}
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-neutral-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                {t('filterHistory')}
              </span>
              {hasActiveFilters && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Active
                </span>
              )}
            </div>
            {hasActiveFilters && (
              <button
                id="btn-clear-filters"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer transition"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t('clearFilters')}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Roadmap Filter */}
            <div>
              <label
                htmlFor="filter-roadmap"
                className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1"
              >
                <span className="inline-flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  {t('allRoadmaps')}
                </span>
              </label>
              <select
                id="filter-roadmap"
                value={filterRoadmapId}
                onChange={handleRoadmapChange}
                className="w-full text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 text-neutral-900 dark:text-neutral-100 py-1.5 px-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">{t('allRoadmaps')}</option>
                {availableRoadmaps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Task Filter */}
            <div>
              <label
                htmlFor="filter-task"
                className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1"
              >
                <span className="inline-flex items-center gap-1">
                  <CheckSquare className="w-3 h-3" />
                  {t('allTasks')}
                </span>
              </label>
              <select
                id="filter-task"
                value={filterTaskId}
                onChange={handleTaskChange}
                className="w-full text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 text-neutral-900 dark:text-neutral-100 py-1.5 px-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">{t('allTasks')}</option>
                {selectableTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>

            {/* From Date */}
            <div>
              <label
                htmlFor="filter-start-date"
                className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1"
              >
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {t('fromDate')}
                </span>
              </label>
              <input
                type="date"
                id="filter-start-date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 text-neutral-900 dark:text-neutral-100 py-1.5 px-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              {filterStartDate && (
                <span className="text-[10px] text-neutral-400 font-mono mt-0.5 block truncate">
                  {formatDate(filterStartDate, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>

            {/* To Date */}
            <div>
              <label
                htmlFor="filter-end-date"
                className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1"
              >
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {t('toDate')}
                </span>
              </label>
              <input
                type="date"
                id="filter-end-date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 text-neutral-900 dark:text-neutral-100 py-1.5 px-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              {filterEndDate && (
                <span className="text-[10px] text-neutral-400 font-mono mt-0.5 block truncate">
                  {formatDate(filterEndDate, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Derived Aggregate Summary Bar */}
        <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold">{t('sessionsCount')}:</span>
              <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                {formatNumeral(historyResult.totalSessions)}
              </span>
            </div>

            <div className="h-3 w-px bg-neutral-200 dark:bg-neutral-800 hidden sm:block" />

            <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
              <Clock className="w-3.5 h-3.5 text-neutral-500" />
              <span className="font-semibold">{t('focusedTime')}:</span>
              <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                {formattedHoursAndMinutes()}
              </span>
              <span className="text-neutral-400 font-mono text-[11px]">
                ({formatNumeral(historyResult.totalMinutes)} {preferences.language === 'fa' ? 'دقیقه' : 'min'})
              </span>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="text-[11px] text-neutral-500 flex items-center gap-2">
              <span>
                {preferences.language === 'fa'
                  ? `نمایش ${formatNumeral(historyResult.totalSessions)} از ${formatNumeral(totalDatabaseSessionsCount)} جلسه`
                  : `Showing ${formatNumeral(historyResult.totalSessions)} of ${formatNumeral(totalDatabaseSessionsCount)} sessions`}
              </span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-neutral-400 animate-pulse">
            Loading session history...
          </div>
        ) : totalDatabaseSessionsCount === 0 ? (
          /* Empty State 1: No sessions in database at all */
          <div className="p-8 text-center rounded-xl bg-white dark:bg-neutral-900 border border-dashed border-neutral-200 dark:border-neutral-800 space-y-3">
            <Clock className="w-8 h-8 text-neutral-400 mx-auto" />
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              No completed sessions recorded yet
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Start an active session using the timer above, or manually record a past work session.
            </p>
            <button
              id="btn-empty-log-manual-session"
              onClick={() => setIsManualModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record a Past Session</span>
            </button>
          </div>
        ) : sessions.length === 0 ? (
          /* Empty State 2: Filters active, but no sessions match */
          <div className="p-8 text-center rounded-xl bg-white dark:bg-neutral-900 border border-dashed border-neutral-200 dark:border-neutral-800 space-y-3">
            <Filter className="w-8 h-8 text-neutral-400 mx-auto" />
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              {t('noMatchingSessions')}
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              {t('noMatchingSessionsDesc')}
            </p>
            <button
              id="btn-empty-clear-filters"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 text-xs font-medium cursor-pointer transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('clearFilters')}</span>
            </button>
          </div>
        ) : (
          /* Filtered Results List: Grouped by Calendar Day (Phase 9C-2) */
          <div className="space-y-4">
            {dayGroups.map((group) => (
              <div
                key={group.dateKey}
                data-testid={`session-day-group-${group.dateKey}`}
                className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-2xs transition-all"
              >
                {/* Daily Header: Date, Relative Label, and Daily Summary */}
                <div className="px-4 py-3 bg-neutral-50/80 dark:bg-neutral-800/50 border-b border-neutral-200/80 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {group.relativeLabel && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 tracking-tight">
                        {group.relativeLabel}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {group.formattedDate}
                    </span>
                  </div>

                  {/* Daily Summary: session count · total focused time */}
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                    <span>{group.formattedSessionCount}</span>
                    <span className="text-neutral-300 dark:text-neutral-600">·</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {group.formattedTotalTime}
                    </span>
                  </div>
                </div>

                {/* Session Rows within this day */}
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                  {group.sessions.map((session) => {
                    const task = tasksMap[session.taskId];
                    const roadmap = task ? roadmapsMap[task.roadmapId] : undefined;
                    const startTime = formatTime(session.startedAt);
                    const endTime = formatTime(session.endedAt);
                    const durationText = formatDurationHoursMinutes(session.durationMinutes);

                    return (
                      <div
                        key={session.id}
                        data-testid={`session-row-${session.id}`}
                        className="p-3.5 sm:px-4 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/25 transition"
                      >
                        {/* Task & Roadmap metadata */}
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 truncate">
                              {task ? task.title : `Task #${session.taskId.slice(0, 8)}`}
                            </span>
                            {task?.status === 'completed' && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-medium">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Done
                              </span>
                            )}
                          </div>

                          {roadmap && (
                            <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                              <Layers className="w-3 h-3 text-neutral-400 shrink-0" />
                              <span className="truncate">{roadmap.title}</span>
                            </div>
                          )}
                        </div>

                        {/* Timing interval & Duration badge */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-neutral-800/40 shrink-0 text-xs">
                          <div className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400 font-mono text-[11px] sm:text-xs">
                            <Clock className="w-3 h-3 text-neutral-400 shrink-0" />
                            <span>{startTime}</span>
                            <span className="text-neutral-400 mx-0.5">→</span>
                            <span>{endTime}</span>
                          </div>

                          <div className="text-right">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono font-semibold text-xs border border-neutral-200 dark:border-neutral-700">
                              {durationText}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Manual Session Modal */}
      <ManualSessionModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSessionCreated={() => {
          loadData();
        }}
      />
    </div>
  );
};
