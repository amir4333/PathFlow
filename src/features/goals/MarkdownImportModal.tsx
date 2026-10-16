import React, { useCallback, useState } from 'react';
import { X, FileUp, AlertCircle, Loader2 } from 'lucide-react';
import { useApplication } from '../../app/providers/ApplicationProvider';
import { useUserPreferences, getTranslation } from '../../app/preferences';
import { parseMarkdownStructure } from '../../application/import/markdownParser';
import { createMarkdownImportDraft } from '../../application/import/markdownDraft';

interface MarkdownImportModalProps {
    onClose: () => void;
    onImported: () => Promise<void>;
}

export const MarkdownImportModal: React.FC<MarkdownImportModalProps> = ({
    onClose,
    onImported,
}) => {
    const application = useApplication();
    const { preferences } = useUserPreferences();
    const lang = preferences.language;

    const t = useCallback(
        (key: Parameters<typeof getTranslation>[0]) => getTranslation(key, lang),
        [lang]
    );

    const [draft, setDraft] = useState<
        ReturnType<typeof createMarkdownImportDraft> | null
    >(null);
    const [error, setError] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [resultMessage, setResultMessage] = useState('');

    const handleFile = async (file?: File) => {
        setError('');
        setResultMessage('');
        setDraft(null);

        if (!file) return;

        try {
            const markdown = await file.text();
            const parsed = parseMarkdownStructure(markdown);
            const nextDraft = createMarkdownImportDraft(parsed);

            if (nextDraft.roadmaps.length === 0) {
                setError(t('markdownImportNoRoadmaps'));
                return;
            }

            setDraft(nextDraft);
        } catch {
            setError(t('markdownImportReadError'));
        }
    };

    const handleImport = async () => {
        if (!draft || isImporting) return;

        setIsImporting(true);
        setError('');
        setResultMessage('');

        let createdGoal = false;
        let createdRoadmaps = 0;
        let createdTasks = 0;

        try {
            const goal = await application.goals.createGoal({
                title: draft.goal.title,
                description: draft.goal.description,
            });
            createdGoal = true;

            for (const roadmapDraft of draft.roadmaps) {
                const roadmap = await application.roadmaps.createRoadmap({
                    goalId: goal.id,
                    title: roadmapDraft.title,
                    description: '',
                });
                createdRoadmaps++;

                for (const taskDraft of roadmapDraft.tasks) {
                    await application.tasks.createTask({
                        roadmapId: roadmap.id,
                        title: taskDraft.title,
                        description: '',
                        status: taskDraft.checked ? 'completed' : 'todo',
                    });
                    createdTasks++;
                }
            }

            await onImported();
            onClose();
        } catch (err) {
            console.error('Markdown import failed', err);

            if (createdGoal) {
                setResultMessage(
                    t('markdownImportPartialResult')
                        .replace('{roadmaps}', String(createdRoadmaps))
                        .replace('{tasks}', String(createdTasks))
                );
            }

            setError(t('markdownImportError'));
        } finally {
            setIsImporting(false);
        }
    };

    const taskCount =
        draft?.roadmaps.reduce((sum, roadmap) => sum + roadmap.tasks.length, 0) ?? 0;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
            onClick={isImporting ? undefined : onClose}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="markdown-import-title"
                className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
                    <h2
                        id="markdown-import-title"
                        className="text-base font-semibold text-neutral-900 dark:text-neutral-100"
                    >
                        {t('markdownImportTitle')}
                    </h2>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isImporting}
                        aria-label={t('closeAction')}
                        className="p-1 rounded-md text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {t('markdownImportDescription')}
                    </p>

                    <label className="block">
                        <span className="block mb-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                            {t('markdownImportFileLabel')}
                        </span>
                        <input
                            type="file"
                            accept=".md,.markdown,.txt,text/markdown,text/plain"
                            disabled={isImporting}
                            onChange={(event) => {
                                void handleFile(event.target.files?.[0]);
                                event.target.value = '';
                            }}
                            className="block w-full text-sm text-neutral-600 dark:text-neutral-400 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white hover:file:bg-emerald-500"
                        />
                    </label>

                    {error && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {resultMessage && (
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                            {resultMessage}
                        </p>
                    )}

                    {draft && (
                        <div className="space-y-4">
                            <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950">
                                <p className="text-xs text-neutral-500 mb-1">
                                    {t('markdownImportGoalLabel')}
                                </p>
                                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 break-words">
                                    {draft.goal.title}
                                </h3>

                                <div className="flex flex-wrap gap-4 mt-3 text-xs text-neutral-600 dark:text-neutral-400">
                                    <span>
                                        {t('markdownImportRoadmapsCount')}: {draft.roadmaps.length}
                                    </span>
                                    <span>
                                        {t('markdownImportTasksCount')}: {taskCount}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {draft.roadmaps.map((roadmap, index) => (
                                    <div
                                        key={`${roadmap.sourceLine}-${index}`}
                                        className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800"
                                    >
                                        <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 break-words">
                                            {roadmap.title}
                                        </h4>

                                        <ul className="mt-2 space-y-1">
                                            {roadmap.tasks.slice(0, 8).map((task, taskIndex) => (
                                                <li
                                                    key={`${task.sourceLine}-${taskIndex}`}
                                                    className="text-xs text-neutral-600 dark:text-neutral-400 break-words"
                                                >
                                                    <span className="me-2">
                                                        {task.checked ? '☑' : '○'}
                                                    </span>
                                                    {task.title}
                                                </li>
                                            ))}

                                            {roadmap.tasks.length > 8 && (
                                                <li className="text-xs text-neutral-500">
                                                    {t('markdownImportMoreTasks').replace(
                                                        '{count}',
                                                        String(roadmap.tasks.length - 8)
                                                    )}
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <footer className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-800">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isImporting}
                        className="px-4 py-2 rounded-lg text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                    >
                        {t('cancel')}
                    </button>

                    <button
                        type="button"
                        onClick={() => void handleImport()}
                        disabled={!draft || isImporting}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                    >
                        {isImporting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <FileUp className="w-4 h-4" />
                        )}
                        {isImporting
                            ? t('markdownImporting')
                            : t('markdownImportAction')}
                    </button>
                </footer>
            </section>
        </div>
    );
};