
export type MarkdownNodeKind = "heading" | "list-item";

export interface ParsedMarkdownNode {
    kind: MarkdownNodeKind;
    text: string;
    level: number;
    line: number;
    checked?: boolean;
    ordered?: boolean;
    children: ParsedMarkdownNode[];
}

export interface MarkdownParseResult {
    nodes: ParsedMarkdownNode[];
    ignoredCodeBlocks: number;
}

export function parseMarkdownStructure(
    markdown: string
): MarkdownParseResult {
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n");

    const nodes: ParsedMarkdownNode[] = [];
    const stack: Array<{
        node: ParsedMarkdownNode;
        indent: number;
    }> = [];

    let inCodeBlock = false;
    let ignoredCodeBlocks = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (/^(```|~~~)/.test(trimmed)) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                ignoredCodeBlocks++;
            } else {
                inCodeBlock = false;
            }
            continue;
        }

        if (inCodeBlock || trimmed.length === 0) {
            continue;
        }

        const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);

        if (headingMatch) {
            const node: ParsedMarkdownNode = {
                kind: "heading",
                text: headingMatch[2].trim(),
                level: headingMatch[1].length,
                line: i + 1,
                children: [],
            };


            while (
                stack.length > 0 &&
                stack[stack.length - 1].node.kind === "list-item"
            ) {
                stack.pop();
            }

            while (
                stack.length > 0 &&
                stack[stack.length - 1].node.kind === "heading" &&
                stack[stack.length - 1].node.level >= node.level
            ) {
                stack.pop();
            }


            if (stack.length > 0) {
                stack[stack.length - 1].node.children.push(node);
            } else {
                nodes.push(node);
            }

            stack.push({ node, indent: -1 });
            continue;
        }

        const listMatch = line.match(
            /^(\s*)(?:([-+*])|(\d+)[.)])\s+(.+)$/
        );

        if (!listMatch) {
            continue;
        }

        const indent = listMatch[1].replace(/\t/g, "    ").length;
        const marker = listMatch[2];
        const content = listMatch[4];

        const checkboxMatch = content.match(/^\[([ xX])\]\s*(.*)$/);
        const text = checkboxMatch ? checkboxMatch[2] : content;

        const node: ParsedMarkdownNode = {
            kind: "list-item",
            text: text.trim(),
            level: indent,
            line: i + 1,
            ...(checkboxMatch
                ? { checked: checkboxMatch[1].toLowerCase() === "x" }
                : {}),
            ...(marker
                ? { ordered: false }
                : { ordered: true }),
            children: [],
        };

        while (
            stack.length > 0 &&
            stack[stack.length - 1].indent >= indent
        ) {
            stack.pop();
        }

        if (stack.length > 0) {
            stack[stack.length - 1].node.children.push(node);
        } else {
            nodes.push(node);
        }

        stack.push({ node, indent });
    }

    return {
        nodes,
        ignoredCodeBlocks,
    };
}