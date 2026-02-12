import * as assert from "assert";
import { upsertAgentsRules } from "../projectControl/agentsRules";
import { MAX_CHECKLIST_ITEMS_PER_TASK, MAX_TITLE_LENGTH } from "../projectControl/constraints";
import { emptyData, normalizeData } from "../projectControl/dataModel";
import { decodeTextBytes, repairCommonMojibake } from "../projectControl/encoding";
import { ingestPromptToTasks } from "../projectControl/ingest";
import { processDataMessage } from "../projectControl/messages";
import { runMultiAgentCycle } from "../projectControl/orchestrator";
import { syncTasksFromOutbox } from "../projectControl/outboxSync";

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
    assert.strictEqual(normalized.tasks[0].links.length, 0);
    assert.strictEqual(normalized.tasks[0].checklist.length, 0);
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
    assert.strictEqual(data.tasks[0].owner, "builder");

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

  test("guardrails clamp title, validate links and dedupe checklist", () => {
    let data = emptyData();
    const longTitle = "A".repeat(MAX_TITLE_LENGTH + 50);
    let step = processDataMessage(data, { type: "createTask", title: longTitle });
    data = step.data;
    const taskId = data.tasks[0].id;

    step = processDataMessage(data, {
      type: "updateTask",
      taskId,
      patch: {
        title: longTitle,
        links: [
          { label: "Bad", href: "javascript:alert(1)" },
          { label: "Good", href: "https://example.com" },
          { label: "Dup", href: "https://example.com" }
        ]
      }
    });
    data = step.data;
    assert.strictEqual(data.tasks[0].title.length, MAX_TITLE_LENGTH);
    assert.strictEqual(data.tasks[0].links.length, 1);
    assert.strictEqual(data.tasks[0].links[0].href, "https://example.com");

    for (let i = 0; i < MAX_CHECKLIST_ITEMS_PER_TASK + 5; i += 1) {
      step = processDataMessage(data, { type: "addChecklistItem", taskId, text: "Repeat" });
      data = step.data;
      step = processDataMessage(data, { type: "addChecklistItem", taskId, text: `Item ${i}` });
      data = step.data;
    }
    assert.strictEqual(data.tasks[0].checklist.length, MAX_CHECKLIST_ITEMS_PER_TASK);
  });

  test("message notices are returned for dropped links and duplicate checklist", () => {
    let data = emptyData();
    let step = processDataMessage(data, { type: "createTask", title: "Task A" });
    data = step.data;
    const taskId = data.tasks[0].id;

    step = processDataMessage(data, {
      type: "updateTask",
      taskId,
      patch: {
        links: [{ label: "bad", href: "not-url" }, { label: "good", href: "https://ok.test" }]
      }
    });
    assert.strictEqual(step.notice?.kind, "info");
    assert.ok((step.notice?.message || "").includes("ignored"));
    data = step.data;

    step = processDataMessage(data, { type: "addChecklistItem", taskId, text: "same" });
    data = step.data;
    step = processDataMessage(data, { type: "addChecklistItem", taskId, text: "same" });
    assert.strictEqual(step.handled, false);
    assert.strictEqual(step.notice?.kind, "error");
  });

  test("syncTasksFromOutbox imports numbered tasks and skips duplicates", () => {
    const data = emptyData();
    data.tasks.push({
      id: "t1",
      title: "Existing task",
      priority: "medium",
      status: "todo",
      owner: "builder",
      description: "",
      links: [],
      checklist: [],
      createdAt: 1,
      updatedAt: 1
    });

    const outbox = `
Created tasks:
1. [high] Existing task
2. [medium] Add activity filters
3. [low] Add sync command
`;
    const result = syncTasksFromOutbox(outbox, data);
    assert.strictEqual(result.createdTasks.length, 2);
    assert.ok(result.data.activity.some((item) => item.type === "outbox_sync"));
  });

  test("runMultiAgentCycle moves task through builder qa scribe pipeline", () => {
    const data = emptyData();
    data.tasks.push({
      id: "task_1",
      title: "Implement feature",
      priority: "medium",
      status: "todo",
      owner: "builder",
      description: "",
      links: [],
      checklist: [],
      createdAt: 1,
      updatedAt: 1
    });

    let step = runMultiAgentCycle(data);
    let task = step.data.tasks[0];
    assert.strictEqual(task.status, "inprogress");
    assert.strictEqual(task.owner, "builder");

    step = runMultiAgentCycle(step.data);
    task = step.data.tasks[0];
    assert.strictEqual(task.status, "todo");
    assert.strictEqual(task.owner, "qa");

    step = runMultiAgentCycle(step.data);
    task = step.data.tasks[0];
    assert.strictEqual(task.status, "inprogress");
    assert.strictEqual(task.owner, "qa");

    step = runMultiAgentCycle(step.data);
    task = step.data.tasks[0];
    assert.strictEqual(task.status, "todo");
    assert.strictEqual(task.owner, "scribe");

    step = runMultiAgentCycle(step.data);
    task = step.data.tasks[0];
    assert.strictEqual(task.status, "inprogress");
    assert.strictEqual(task.owner, "scribe");

    step = runMultiAgentCycle(step.data);
    task = step.data.tasks[0];
    assert.strictEqual(task.status, "done");
  });

  test("repairCommonMojibake restores broken UTF-8 Russian text", () => {
    const broken = "РџСЂРёРІРµС‚, РјРёСЂ";
    const fixed = repairCommonMojibake(broken);
    assert.strictEqual(fixed, "Привет, мир");
  });

  test("decodeTextBytes supports cp1251 fallback for Russian text", () => {
    // "Привет" in windows-1251 bytes
    const cp1251Bytes = Uint8Array.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]);
    const decoded = decodeTextBytes(cp1251Bytes);
    assert.strictEqual(decoded, "Привет");
  });

  test("upsertAgentsRules creates rules when AGENTS.md is missing", () => {
    const result = upsertAgentsRules("");
    assert.ok(result.includes("# Codex Project Rules"));
    assert.ok(result.includes("Всегда работай через Project Control."));
  });

  test("upsertAgentsRules does not duplicate equivalent existing rules", () => {
    const existing = `# Codex Project Rules

Всегда работай через Project Control.

Правила:
- Режим работы строго по фазам:
- Перед началом работы создай/обнови задачи в \`.project-control/data.json\` через команды/контракт расширения.
- Если пользователь дал новый большой промпт, используй \`Project Control: Ingest Prompt\`.
- Если есть структурированный \`agent_outbox.md\`, используй \`Project Control: Sync From Outbox\`.
`;
    const result = upsertAgentsRules(existing);
    assert.strictEqual(result, existing);
  });

  test("upsertAgentsRules upgrades legacy plain rules to managed block", () => {
    const existing = `# Codex Project Rules

Всегда работай через Project Control.

Правила:
- Перед началом работы создай/обнови задачи в \`.project-control/data.json\` через команды/контракт расширения.
- Если пользователь дал новый большой промпт, используй \`Project Control: Ingest Prompt\`.
- Если есть структурированный \`agent_outbox.md\`, используй \`Project Control: Sync From Outbox\`.
`;
    const result = upsertAgentsRules(existing);
    assert.ok(result.includes("<!-- project-control:start -->"));
    assert.ok(result.includes("Режим работы строго по фазам:"));
  });

  test("upsertAgentsRules replaces managed block by markers", () => {
    const existing = `# Team Rules

<!-- project-control:start -->
old block
<!-- project-control:end -->
`;
    const result = upsertAgentsRules(existing);
    assert.ok(result.includes("# Team Rules"));
    assert.ok(result.includes("# Codex Project Rules"));
    assert.ok(!result.includes("old block"));
  });
});
