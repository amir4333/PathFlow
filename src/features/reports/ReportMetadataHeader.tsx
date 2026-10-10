import React from 'react';
import { FileText, ShieldCheck, Calendar, Clock, Globe } from 'lucide-react';
import { ReportMetadata } from '../../domain';
import { useUserPreferences, getTranslation } from '../../app/preferences';

export interface ReportMetadataHeaderProps {
  readonly metadata: ReportMetadata;
}

export const ReportMetadataHeader: React.FC<ReportMetadataHeaderProps> = ({ metadata }) => {
  const { preferences, formatDate, formatTime } = useUserPreferences();
  const t = (k: any) => getTranslation(k, preferences.language);

  const getScopeLabel = () => {
    if (metadata.scope.type === 'goal') {
      return `${t('scopeGoal')}: ${metadata.scope.goalTitle ?? metadata.scope.goalId}`;
    }
    if (metadata.scope.type === 'roadmap') {
      return `${t('scopeRoadmap')}: ${metadata.scope.roadmapTitle ?? metadata.scope.roadmapId}`;
    }
    return t('scopeAll');
  };

  const getLocalizedTitle = () => {
    if (!metadata.title || metadata.title === 'PathFlow Official Progress Report') {
      return t('reportsTitle');
    }
    return metadata.title;
  };

  const getLocalizedReviewPeriodLabel = () => {
    const startFormatted = formatDate(metadata.reviewPeriod.startDate, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const endFormatted = formatDate(metadata.reviewPeriod.endDate, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const periodPrefix =
      metadata.reviewPeriod.type === 'this-week'
        ? t('thisWeek')
        : metadata.reviewPeriod.type === 'last-week'
        ? t('lastWeek')
        : t('customRange');

    return `${periodPrefix} (${startFormatted} – ${endFormatted})`;
  };

  const getLocalizedSystemLabel = () => {
    const langLabel = metadata.language === 'fa' ? t('persian') : t('english');
    const calLabel = metadata.calendar === 'persian' ? t('persianJalali') : t('gregorian');
    return `${langLabel} / ${calLabel}`;
  };

  return (
    <div
      id="report-metadata-header"
      className="border-b border-neutral-300 dark:border-neutral-700 pb-6 mb-6 print-avoid-break"
    >
      {/* Document Header Title & Seal */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="report-status-badge inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold tracking-wide bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              {t('officialDocumentNotice')}
            </span>
            <span className="report-status-badge inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
              <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span dir="ltr">PathFlow OS</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            {getLocalizedTitle()}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-1 max-w-3xl leading-relaxed">
            {t('officialDocumentDesc')}
          </p>
        </div>

        {/* Generated Timestamp Box */}
        <div className="report-meta-box shrink-0 bg-neutral-50 dark:bg-neutral-800/60 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700/80 text-xs space-y-1">
          <div className="text-[11px] text-neutral-500 font-semibold">
            {t('generatedAt')}
          </div>
          <div className="tabular-nums text-neutral-900 dark:text-neutral-100 font-semibold">
            {formatDate(metadata.generatedAt, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}{' '}
            <span className="text-neutral-500 text-[11px] font-normal">
              • {formatTime(metadata.generatedAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Metadata Attributes Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-neutral-200 dark:border-neutral-800 text-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-neutral-500 shrink-0" />
          <div>
            <span className="text-neutral-500">{t('reviewPeriod')}: </span>
            <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
              {getLocalizedReviewPeriodLabel()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-neutral-500 shrink-0" />
          <div>
            <span className="text-neutral-500">{t('reportScope')}: </span>
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              {getScopeLabel()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-neutral-500 shrink-0" />
          <div>
            <span className="text-neutral-500">{t('systemLabel')}: </span>
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              {getLocalizedSystemLabel()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
