import React, { useEffect, useState, useCallback } from 'react';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { useRouter } from '../../app/providers/RouterProvider';
import { Goal, Roadmap } from '../../domain';
import { RoadmapDetailedProgress } from '../../domain/services/progressReview';
import {
  MapPin,
  Target,
  ArrowRight,
  Layers,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react';

export const RoadmapListView: React.FC = () => {
  const { navigate } = useRouter();
  const application = useApplication();

  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, RoadmapDetailedProgress>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [fetchedRoadmaps, fetchedGoals] = await Promise.all([
        application.roadmaps.listRoadmaps(),
        application.goals.listGoals(),
      ]);

      setRoadmaps(fetchedRoadmaps);
      setGoals(fetchedGoals);

      // Load progress
      const pMap: Record<string, RoadmapDetailedProgress> = {};
      await Promise.all(
        fetchedRoadmaps.map(async (r) => {
          try {
            const p = await application.progress.getRoadmapProgress(r.id);
            pMap[r.id] = p;
          } catch (err) {
            console.error(`Failed to load progress for roadmap ${r.id}`, err);
          }
        })
      );
      setProgressMap(pMap);
    } catch (err) {
      console.error('Failed to load roadmaps list', err);
    } finally {
      setIsLoading(false);
    }
  }, [application]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const goalMap = new Map<string, Goal>(goals.map((g) => [g.id, g]));

  return (
    <div id="roadmaps-list-view" className="max-w-6xl mx-auto space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              Strategic Roadmaps
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
            Decomposed milestone sequences and strategic pathways toward goals.
          </p>
        </div>

        <button
          id="btn-nav-to-goals"
          onClick={() => navigate('goals')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer transition"
        >
          <Target className="w-4 h-4" />
          <span>Manage Goals</span>
        </button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-sm text-neutral-500">
          Loading roadmaps from local database...
        </div>
      ) : roadmaps.length === 0 ? (
        <div
          id="roadmaps-index-empty"
          className="p-12 text-center bg-white dark:bg-neutral-900 border border-dashed border-neutral-300 dark:border-neutral-800 rounded-xl space-y-4"
        >
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              No Roadmaps Created Yet
            </h2>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              Roadmaps are milestone pathways created within a Goal. Create or open a Goal to establish milestone tracks.
            </p>
          </div>
          <button
            onClick={() => navigate('goals')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Go to Goals to Create Roadmap</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {roadmaps.map((roadmap) => {
            const parentGoal = goalMap.get(roadmap.goalId);
            const rProg = progressMap[roadmap.id];
            const taskPct = rProg ? rProg.taskCompletionPercentage : 0;

            return (
              <div
                key={roadmap.id}
                id={`roadmap-card-${roadmap.id}`}
                onClick={() => navigate('roadmaps', { id: roadmap.id })}
                className="group p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 rounded-xl shadow-xs transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/80">
                      Roadmap
                    </span>
                    {parentGoal && (
                      <span className="text-xs text-neutral-500 truncate max-w-[200px]">
                        Goal: <span className="font-medium text-neutral-700 dark:text-neutral-300">{parentGoal.title}</span>
                      </span>
                    )}
                  </div>

                  <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
                    {roadmap.title}
                  </h2>

                  {roadmap.description && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1.5 line-clamp-2">
                      {roadmap.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3.5 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">
                      {rProg ? `${rProg.completedTasks}/${rProg.totalTasks} Tasks Completed` : '0 Tasks'}
                    </span>
                    <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                      {taskPct}%
                    </span>
                  </div>

                  <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min(taskPct, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-neutral-500">
                    <span>{rProg ? `${rProg.totalActualMinutes}m logged` : '0m logged'}</span>
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium group-hover:translate-x-0.5 transition-transform">
                      <span>View Roadmap Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
