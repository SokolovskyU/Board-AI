import * as assert from "assert";
import { ingestPromptToTasks } from "../projectControl/ingest";
import { processDataMessage } from "../projectControl/messages";
import { emptyData, normalizeData } from "../projectControl/storage";

suite("Project Control Core", () => {
  test("normalizeData fills defaults and sanitizes invalid fields", () => {
    const normalized = normalizeData({
      tasks: [
        {
          title: 42,
          priority: "urgent",
          status: "doing",
          links: [{ label: 12, href: 7 }],
          checklist: [{ text: 999 }]
        }
      ],
      docMarkdown: 123,
      activity: [{ type: 1, message: 2, ts: "now" }]
    });

    assert.strictEqual(normalized.version, 1);
    assert.strictEqual(normalized.tasks.length, 1);
    assert.strictEqual(normalized.tasks[0].title, "Untitled task");
    assert.strictEqual(normalized.tasks[0].priority, "medium");
    assert.strictEqual(normalized.tasks[0].status, "todo");
    assert.strictEqual(normalized.tasks[0].links[0].href, "#");
    assert.strictEqual(typeof normalized.docMarkdown, "string");
    assert.ok(normalized.activity.length > 0);
  });

  test("ingestPromptToTasks creates tasks from bullets", () => {
    const prompt = `
- Build checklist CRUD (high priority)
- Add docs autosave debounce
- [ ] Add tests
`;
    const result = ingestPromptToTasks(prompt, emptyData());

    assert.strictEqual(result.createdTasks.length, 3);
    assert.strictEqual(result.createdTasks[0].priority, "high");
    assert.strictEqual(result.data.tasks.length, 3);
    assert.ok(result.summary.includes("Created tasks"));
    assert.ok(result.data.activity.some((item) => item.type === "ingest"));
  });

  test("message flow handles create, move, saveMainDoc and saveDoc", () => {
    let data = emptyData();

    let step = processDataMessage(data, { type: "createTask", title: "Implement parser" });
    assert.strictEqual(step.handled, true);
    data = step.data;
    assert.strictEqual(data.tasks.length, 1);
    const taskId = data.tasks[0].id;

    step = processDataMessage(data, { type: "moveTask", id: taskId, status: "inprogress" });
    assert.strictEqual(step.handled, true);
    data = step.data;
    assert.strictEqual(data.tasks[0].status, "inprogress");

    step = processDataMessage(data, { type: "saveMainDoc", content: "# Notes" });
    assert.strictEqual(step.handled, true);
    data = step.data;
    assert.strictEqual(data.docMarkdown, "# Notes");

    step = processDataMessage(data, { type: "saveDoc", name: "design", content: "doc body" });
    assert.strictEqual(step.handled, true);
    assert.ok(step.docWrite);
    assert.strictEqual(step.docWrite?.name, "design.md");
    assert.strictEqual(step.docWrite?.content, "doc body");
  });
});
