import React from 'react';
import { useRouter } from '../../app/providers/RouterProvider';
import { APP_CONFIG } from '../../app/config/appConfig';
import { AppRouteId, APP_ROUTES } from '../../app/routes/routes';
import { Layers, ArrowRight, ShieldCheck, Clock } from 'lucide-react';

interface PlaceholderViewProps {
  routeId: AppRouteId;
  title: string;
  description: string;
  plannedPhase: string;
  workflowStep?: string;
  responsibilities: string[];
}

export const PlaceholderView: React.FC<PlaceholderViewProps> = ({
  routeId,
  title,
  description,
  plannedPhase,
  workflowStep,
  responsibilities,
}) => {
  const { navigate } = useRouter();

  return (
    <div id={`placeholder-view-${routeId}`} className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner Notice */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 flex items-start gap-4">
        <div className="p-2 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg shrink-0 mt-0.5">
          <Clock className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
              Foundation Shell Only
            </span>
            <span className="text-xs text-neutral-500">
              Scheduled: {plannedPhase}
            </span>
          </div>
          <h2 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
            {title} will be implemented in a later phase
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            This screen serves as a structural routing placeholder in Phase 1 to verify shell layout, navigation, and module isolation. No premature business logic or mock data is injected.
          </p>
        </div>
      </div>

      {/* Module Overview Card */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-xs space-y-6">
        <div className="border-b border-neutral-200 dark:border-neutral-800 pb-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">
                <span>Feature Module</span>
                <span>•</span>
                <span>{routeId}</span>
              </div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {title}
              </h1>
            </div>
            {workflowStep && (
              <div className="px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                Core Workflow: {workflowStep}
              </div>
            )}
          </div>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
            {description}
          </p>
        </div>

        {/* Workflow Chain Visualizer */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
            System Workflow Alignment
          </h3>
          <div className="flex flex-wrap items-center gap-2 p-3 bg-neutral-50 dark:bg-neutral-950/50 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs">
            {APP_CONFIG.coreWorkflow.map((step, idx) => {
              const isCurrent = workflowStep?.toLowerCase() === step.toLowerCase();
              return (
                <React.Fragment key={step}>
                  <span
                    className={`px-2.5 py-1 rounded font-medium transition-colors ${
                      isCurrent
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 ring-1 ring-neutral-400'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    {step}
                  </span>
                  {idx < APP_CONFIG.coreWorkflow.length - 1 && (
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Planned Responsibilities Grid */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
            Planned Responsibilities (Phase 2+)
          </h3>
          <ul className="grid sm:grid-cols-2 gap-2.5">
            {responsibilities.map((item, index) => (
              <li
                key={index}
                className="flex items-start gap-2.5 text-sm p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950/40 border border-neutral-200/70 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 mt-2 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Architectural Boundaries Checklist */}
        <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Architectural Integrity Guarantee</span>
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            In compliance with local-first architectural standards, this component remains free of direct database access, network calls, state mutations, or business domain algorithms.
          </p>
        </div>

        {/* Quick Navigation Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <button
            id={`btn-back-to-dashboard-${routeId}`}
            onClick={() => navigate('dashboard')}
            className="text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
          >
            ← Return to Dashboard
          </button>
          <div className="flex gap-2">
            {APP_ROUTES.filter((r) => r.id !== routeId && r.id !== 'dashboard').slice(0, 3).map((r) => (
              <button
                key={r.id}
                id={`btn-nav-to-${r.id}`}
                onClick={() => navigate(r.id)}
                className="text-xs px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
