
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseMarkdownStructure } from "../../src/application/import/markdownParser";
import { createMarkdownImportDraft } from "../../src/application/import/markdownDraft";

describe("createMarkdownImportDraft", () => {
    it("عنوان پروژه، هفته‌ها و وظایف را استخراج می‌کند", () => {
        const markdown = [
            "# نقشه راه پروژه Game Systems Lab",
            "",
            "## هفته اول — Inventory System",
            "- طراحی مدل آیتم‌ها",
            "- [ ] پیاده‌سازی Inventory",
            "- [x] نوشتن تست‌ها",
            "",
            "## هفته دوم — Event System",
            "- طراحی سیستم رویداد",
        ].join("\n");

        const parsed = parseMarkdownStructure(markdown);
        const draft = createMarkdownImportDraft(parsed);

        assert.equal(draft.goal.title, "Game Systems Lab");
        assert.equal(draft.roadmaps.length, 2);

        assert.equal(draft.roadmaps[0].title, "هفته اول — Inventory System");
        assert.equal(draft.roadmaps[0].tasks.length, 3);
        assert.equal(draft.roadmaps[0].tasks[1].checked, false);
        assert.equal(draft.roadmaps[0].tasks[2].checked, true);

        assert.equal(draft.roadmaps[1].tasks.length, 1);
        assert.equal(draft.roadmaps[1].tasks[0].title, "طراحی سیستم رویداد");
    });
});
