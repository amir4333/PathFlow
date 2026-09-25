import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Printer,
  FileDown,
  RefreshCw,
  Calendar,
  Layers,
  Filter,
  AlertCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useRouter } from '../../app/providers/RouterProvider';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { useUserPreferences, getTranslation } from '../../app/preferences';
import { OfficialProgressReport, Goal, Roadmap, ReportScopeType } from '../../domain';
import { ReportMetadataHeader } from './ReportMetadataHeader';
import { ReportOverviewSection } from './ReportOverviewSection';
import { ReportGoalsSection } from './ReportGoalsSection';
import { ReportRoadmapsSection } from './ReportRoadmapsSection';
import { ReportTasksSection } from './ReportTasksSection';
import { ReportSessionsSection } from './ReportSessionsSection';
import { ReportWeeklyPlanningSection } from './ReportWeeklyPlanningSection';
import { ReportDailyActivitySection } from './ReportDailyActivitySection';

type PeriodType = 'this-week' | 'last-week' | 'custom';

export const ReportsView: React.FC = () => {
  const { params } = useRouter();
  const application = useApplication();
  const { preferences, formatDate, formatNumeral } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  // Review Period State
  const [periodType, setPeriodType] = useState<PeriodType>('this-week');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Scope State (defaults from route params if provided)
  const [scopeType, setScopeType] = useState<ReportScopeType>(() => {
    if (params.scopeType === 'goal' || params.scopeType === 'roadmap') {
      return params.scopeType;
    }
    return 'all';
  });
  const [selectedGoalId, setSelectedGoalId] = useState<string>(() => params.goalId || '');
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string>(() => params.roadmapId || '');

  // Available options for scope dropdowns
  const [availableGoals, setAvailableGoals] = useState<Goal[]>([]);
  const [availableRoadmaps, setAvailableRoadmaps] = useState<Roadmap[]>([]);

  // Generated Report Data
  const [report, setReport] = useState<OfficialProgressReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch scope options on mount
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      application.goals.listGoals(),
      application.roadmaps.listRoadmaps(),
    ])
      .then(([goals, roadmaps]) => {
        if (!isMounted) return;
        setAvailableGoals(goals);
        setAvailableRoadmaps(roadmaps);
        if (!selectedGoalId && goals.length > 0) {
          setSelectedGoalId(goals[0].id);
        }
        if (!selectedRoadmapId && roadmaps.length > 0) {
          setSelectedRoadmapId(roadmaps[0].id);
        }
      })
      .catch((err) => {
        console.error('Failed to load scope options', err);
      });
    return () => {
      isMounted = false;
    };
  }, [application]);

  // Main Report Generation
  const generateReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const generated = await application.reports.generateReport({
        periodType,
        customStartDate: periodType === 'custom' ? customStartDate : undefined,
        customEndDate: periodType === 'custom' ? customEndDate : undefined,
        scope: {
          type: scopeType,
          goalId: scopeType === 'goal' ? selectedGoalId : undefined,
          roadmapId: scopeType === 'roadmap' ? selectedRoadmapId : undefined,
        },
        language: preferences.language,
        calendar: preferences.calendar,
      });

      setReport(generated);
    } catch (err: any) {
      console.error('Failed to generate report', err);
      setError(err?.message || 'Failed to generate progress report.');
    } finally {
      setIsLoading(false);
    }
  }, [
    application,
    periodType,
    customStartDate,
    customEndDate,
    scopeType,
    selectedGoalId,
    selectedRoadmapId,
    preferences.language,
    preferences.calendar,
  ]);

  useEffect(() => {
    generateReport();
  }, [generateReport]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div id="reports-view-root" className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Controls & Configuration Bar (Hidden in Print) */}
      <div className="print:hidden bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {t('reportsTitle')}
              </h1>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              {t('reportsSubtitle')}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              id="btn-print-report"
              onClick={handlePrint}
              disabled={isLoading || !report}
              aria-label={t('printAction')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t('printAction')}</span>
            </button>
            <button
              id="btn-save-as-pdf"
              onClick={handlePrint}
              disabled={isLoading || !report}
              aria-label={t('saveAsPdf')}
              title={t('printHelpText')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>{t('saveAsPdf')}</span>
            </button>
            <button
              id="btn-refresh-report"
              onClick={generateReport}
              disabled={isLoading}
              className="p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
              title={t('refresh')}
              aria-label={t('refresh')}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Configuration Selectors: Period & Scope */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-neutral-200 dark:border-neutral-800 text-xs">
          {/* 1. Review Period Selection */}
          <div className="space-y-2">
            <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-neutral-500" />
              {t('reviewPeriod')}
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPeriodType('this-week')}
                className={`px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                  periodType === 'this-week'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {t('thisWeek')}
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('last-week')}
                className={`px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                  periodType === 'last-week'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {t('lastWeek')}
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('custom')}
                className={`px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                  periodType === 'custom'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {t('customRange')}
              </button>
            </div>

            {/* Custom Range Inputs */}
            {periodType === 'custom' && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
                <span className="text-neutral-500 text-xs">→</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
            )}
          </div>

          {/* 2. Report Scope Selection */}
          <div className="space-y-2">
            <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-neutral-500" />
              {t('reportScope')}
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setScopeType('all')}
                className={`px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                  scopeType === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {t('scopeAll')}
              </button>
              <button
                type="button"
                onClick={() => setScopeType('goal')}
                className={`px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                  scopeType === 'goal'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {t('scopeGoal')}
              </button>
              <button
                type="button"
                onClick={() => setScopeType('roadmap')}
                className={`px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                  scopeType === 'roadmap'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {t('scopeRoadmap')}
              </button>
            </div>

            {/* Target Goal Selector */}
            {scopeType === 'goal' && (
              <div className="pt-1">
                <select
                  value={selectedGoalId}
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                >
                  {availableGoals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title} ({g.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Target Roadmap Selector */}
            {scopeType === 'roadmap' && (
              <div className="pt-1">
                <select
                  value={selectedRoadmapId}
                  onChange={(e) => setSelectedRoadmapId(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                >
                  {availableRoadmaps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && !report && (
        <div className="p-12 text-center text-neutral-500 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
          <div className="text-sm font-medium">{t('loadingProgress')}</div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-800 dark:text-rose-300 flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* Official Report Document Body */}
      {report && (
        <article
          id="official-report-document"
          className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-10 shadow-sm print:shadow-none print:border-none print:p-0 print:m-0 print:text-black print:bg-white"
        >
          {/* Document Metadata Header */}
          <ReportMetadataHeader metadata={report.metadata} />

          {/* 1. Overview */}
          <ReportOverviewSection overview={report.overview} />

          {/* 2. Goals Section */}
          <ReportGoalsSection goals={report.goals} />

          {/* 3. Roadmaps Section */}
          <ReportRoadmapsSection roadmaps={report.roadmaps} />

          {/* 4. Tasks Section */}
          <ReportTasksSection tasks={report.tasks} />

          {/* 5. Sessions Summary */}
          <ReportSessionsSection sessionsSummary={report.sessionsSummary} />

          {/* 6. Weekly Planning Summary */}
          <ReportWeeklyPlanningSection weeklyPlanning={report.weeklyPlanning} />

          {/* 7. Daily Activity Breakdown */}
          <ReportDailyActivitySection dailyActivity={report.dailyActivity} />

          {/* Official Document Footer */}
          <footer className="pt-6 mt-8 border-t border-neutral-300 dark:border-neutral-800 text-[11px] text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{t('verificationNotice')}</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-right">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {t('printFooterNotice')} • {t('generatedAt')}: {formatDate(report.metadata.generatedAt, { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
              <span className="font-mono text-neutral-400">
                {t('deterministicRecordNotice')}
              </span>
            </div>
          </footer>
        </article>
      )}
    </div>
  );
};
