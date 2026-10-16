
import type {
    ParsedMarkdownNode,
    MarkdownParseResult,
} from "./markdownParser";

export interface MarkdownTaskDraft {
    title: string;
    sourceLine: number;
    checked?: boolean;
}

export interface MarkdownRoadmapDraft {
    title: string;
    sourceLine: number;
    tasks: MarkdownTaskDraft[];
}

export interface MarkdownImportDraft {
    goal: {
        title: string;
        description: string;
    };
    roadmaps: MarkdownRoadmapDraft[];
}

function getAllNodes(
    nodes: ParsedMarkdownNode[]
): ParsedMarkdownNode[] {
    const result: ParsedMarkdownNode[] = [];

    for (const node of nodes) {
        result.push(node);
        result.push(...getAllNodes(node.children));
    }

    return result;
}

function isWeekHeading(text: string): boolean {
    return /^هفته\s+(?:اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|نهم|دهم|یازدهم|[۰-۹0-9]+)/.test(
        text.trim()
    );
}

function getListItems(
    nodes: ParsedMarkdownNode[]
): MarkdownTaskDraft[] {
    const tasks: MarkdownTaskDraft[] = [];

    for (const node of nodes) {
        if (node.kind === "list-item" && node.text.trim()) {
            tasks.push({
                title: node.text.trim(),
                sourceLine: node.line,
                ...(node.checked === undefined
                    ? {}
                    : { checked: node.checked }),
            });
        }

        tasks.push(...getListItems(node.children));
    }

    return tasks;
}

function cleanGoalTitle(title: string): string {
    return title
        .replace(/^نقشه\s+راه\s+پروژه\s*/i, "")
        .trim();
}

export function createMarkdownImportDraft(
    parsed: MarkdownParseResult
): MarkdownImportDraft {
    const allNodes = getAllNodes(parsed.nodes);

    const firstHeading = allNodes.find(
        (node) => node.kind === "heading"
    );

    const goalTitle = firstHeading
        ? cleanGoalTitle(firstHeading.text)
        : "";

    const roadmaps: MarkdownRoadmapDraft[] = [];

    for (const node of allNodes) {
        if (node.kind !== "heading" || !isWeekHeading(node.text)) {
            continue;
        }

        roadmaps.push({
            title: node.text.trim(),
            sourceLine: node.line,
            tasks: getListItems(node.children),
        });
    }

    return {
        goal: {
            title: goalTitle || "هدف واردشده از Markdown",
            description: "",
        },
        roadmaps,
    };
}
