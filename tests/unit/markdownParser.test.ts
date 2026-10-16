
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseMarkdownStructure } from "../../src/application/import/markdownParser";

describe("parseMarkdownStructure", () => {
    it("تشخیص عنوان‌ها و رابطهٔ والد و فرزند را بررسی می‌کند", () => {
        const result = parseMarkdownStructure(
            "# پروژه\n## هفته اول\n### موجودی"
        );

        assert.equal(result.nodes.length, 1);
        assert.equal(result.nodes[0].text, "پروژه");
        assert.equal(result.nodes[0].children[0].text, "هفته اول");
        assert.equal(
            result.nodes[0].children[0].children[0].text,
            "موجودی"
        );
    });

    it("فهرست‌های تو‌در‌تو را حفظ می‌کند", () => {
        const result = parseMarkdownStructure(
            "# پروژه\n- طراحی مدل\n  - قوانین انباشته‌سازی\n- نوشتن تست"
        );

        const items = result.nodes[0].children;

        assert.equal(items.length, 2);
        assert.equal(items[0].text, "طراحی مدل");
        assert.equal(items[0].children[0].text, "قوانین انباشته‌سازی");
        assert.equal(items[1].text, "نوشتن تست");
    });

    it("وضعیت چک‌لیست و نوع فهرست را تشخیص می‌دهد", () => {
        const result = parseMarkdownStructure(
            "# برنامه\n- [ ] انجام‌نشده\n- [x] انجام‌شده\n1. مورد شماره‌دار"
        );

        const items = result.nodes[0].children;

        assert.equal(items[0].checked, false);
        assert.equal(items[1].checked, true);
        assert.equal(items[2].ordered, true);
        assert.equal(items[0].ordered, false);
    });

    it("محتوای داخل بلوک کد را نادیده می‌گیرد", () => {
        const result = parseMarkdownStructure(
            "# پروژه\n```ts\n# این عنوان نیست\n- این وظیفه نیست\n```\n- وظیفه واقعی"
        );

        assert.equal(result.ignoredCodeBlocks, 1);
        assert.equal(result.nodes[0].children.length, 1);
        assert.equal(result.nodes[0].children[0].text, "وظیفه واقعی");
    });

    it("شماره خط اصلی هر مورد را حفظ می‌کند", () => {
        const result = parseMarkdownStructure(
            "# پروژه\n\n- وظیفه اول\n\n- وظیفه دوم"
        );

        const items = result.nodes[0].children;

        assert.equal(items[0].line, 3);
        assert.equal(items[1].line, 5);
    });

    it("بعد از فهرست، عنوان جدید را زیر مورد قبلی قرار نمی‌دهد", () => {
        const result = parseMarkdownStructure(
            "# پروژه\n- وظیفه اول\n## هفته دوم"
        );

        assert.equal(result.nodes[0].children.length, 2);
        assert.equal(result.nodes[0].children[0].text, "وظیفه اول");
        assert.equal(result.nodes[0].children[0].children.length, 0);
        assert.equal(result.nodes[0].children[1].text, "هفته دوم");
    });
});
