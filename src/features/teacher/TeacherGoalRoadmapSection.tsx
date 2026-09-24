import React, { useState } from 'react';
import { Target, MapPin, CheckCircle2, Clock, ChevronDown, ChevronRight, Layers, BarChart2, ExternalLink } from 'lucide-react';
import { useRouter } from '../../app/providers/RouterProvider';
import { GoalPeriodProgress, RoadmapPeriodProgress } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';

export interface TeacherGoalRoadmapSectionProps {
  readonly goals: readonly GoalPeriodProgress[];
  readonly roadmaps: readonly RoadmapPeriodProgress[];
}

export const TeacherGoalRoadmapSection: React.FC<TeacherGoalRoadmapSectionProps> = ({
  goals,
  roadmaps,
}) => {
  const { navigate } = useRouter();
  const { preferences, formatDurationHoursMinutes, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  const [filterMode, setFilterMode] = useState<'all' | 'active'>('all');
  const [expandedGoalIds, setExpandedGoalIds] = useState<Record<string, boolean>>(() => {
    // Expand active goals by default
    const initial: Record<string, boolean> = {};
    goals.forEach((g) => {
      initial[g.goalId] = true;
    });
    return initial;
  });

  const toggleExpand = (goalId: string) => {
    setExpandedGoalIds((prev) => ({
      ...prev,
      [goalId]: !prev[goalId],
    }));
  };

  const filteredGoals = filterMode === 'active'
    ? goals.filter((g) => g.hasActivityInPeriod || g.actualMinutes > 0 || g.plannedMinutes > 0)
    : goals;

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-2xs space-y-4">
      {/* Header with Title and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Target className="w-5 h-5 text-indigo-500" />
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {t('goalOverview')} &amp; {t('roadmapOverview')}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
            {formatNumeral(filteredGoals.length)} {t('activeGoals')}
          </span>
        </div>

        {/* Filter Toggle */}
        <div className="inline-flex p-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs font-medium self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1 rounded-md transition-all ${
              filterMode === 'all'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            {t('allGoals')} ({formatNumeral(goals.length)})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('active')}
            className={`px-3 py-1 rounded-md transition-all ${
              filterMode === 'active'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            {t('activeGoals')} ({formatNumeral(goals.filter((g) => g.hasActivityInPeriod || g.actualMinutes > 0 || g.plannedMinutes > 0).length)})
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredGoals.length === 0 ? (
        <div className="text-center py-8 text-sm text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
          {t('noGoalsFound')}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGoals.map((goal) => {
            const isExpanded = !!expandedGoalIds[goal.goalId];
            const childRoadmaps = roadmaps.filter((r) => r.goalId === goal.goalId);

            return (
              <div
                key={goal.goalId}
                className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-neutral-50/40 dark:bg-neutral-900/40 transition"
              >
                {/* Goal Header Row */}
                <div
                  onClick={() => toggleExpand(goal.goalId)}
                  className="p-4 bg-white dark:bg-neutral-900 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition select-none"
                >
                  <div className="flex items-start md:items-center space-x-3 min-w-0">
                    <button
                      type="button"
                      aria-label="Toggle goal roadmaps"
                      className="mt-0.5 md:mt-0 p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                          {goal.title}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">
                          {goal.status}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center space-x-3 mt-1 flex-wrap">
                        <span>
                          {t('roadmapsCount')}: {formatNumeral(goal.totalRoadmaps)}
                        </span>
                        <span>•</span>
                        <span>
                          {t('tasksCount')}: {formatNumeral(goal.completedTasks)} / {formatNumeral(goal.totalTasks)} ({formatNumeral(goal.taskCompletionPercentage)}%)
                        </span>
                        {(goal.plannedMinutes > 0 || goal.actualMinutes > 0) && (
                          <>
                            <span>•</span>
                            <span className="flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-neutral-400" />
                              <span>{formatDurationHoursMinutes(goal.actualMinutes)} {t('actualTime')}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Goal Progress Bar & Drill-down */}
                  <div className="flex items-center space-x-3 shrink-0 self-stretch md:self-auto justify-between md:justify-end">
                    <div className="w-28 bg-neutral-200 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, goal.taskCompletionPercentage)}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 w-10 text-right">
                      {formatNumeral(goal.taskCompletionPercentage)}%
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`teacher-view/goal/${goal.goalId}`);
                      }}
                      className="px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-medium flex items-center space-x-1 cursor-pointer transition"
                      title={t('drillDownToGoal')}
                    >
                      <span>{t('goalDetails')}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Nested Roadmaps under this Goal */}
                {isExpanded && (
                  <div className="border-t border-neutral-200 dark:border-neutral-800 px-4 py-3 space-y-2 bg-neutral-50/50 dark:bg-neutral-950/40">
                    <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                      {t('roadmapOverview')} ({formatNumeral(childRoadmaps.length)})
                    </div>

                    {childRoadmaps.length === 0 ? (
                      <div className="text-xs text-neutral-400 dark:text-neutral-500 italic py-2">
                        {t('noRoadmapsFound')}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {childRoadmaps.map((roadmap) => (
                          <div
                            key={roadmap.roadmapId}
                            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 text-xs flex flex-col justify-between space-y-2 shadow-2xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center space-x-1.5 min-w-0">
                                <Layers className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                                  {roadmap.title}
                                </span>
                              </div>
                              <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 shrink-0">
                                {formatNumeral(roadmap.taskCompletionPercentage)}%
                              </span>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, roadmap.taskCompletionPercentage)}%` }}
                              />
                            </div>

                            {/* Metrics footer & Drill-down */}
                            <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                              <span>
                                {t('tasksCount')}: {formatNumeral(roadmap.completedTasks)} / {formatNumeral(roadmap.totalTasks)}
                              </span>
                              <button
                                type="button"
                                onClick={() => navigate(`teacher-view/roadmap/${roadmap.roadmapId}`)}
                                className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                              >
                                <span>{t('roadmapDetails')}</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
