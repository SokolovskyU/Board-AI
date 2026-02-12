import { sanitizeTitle } from "./constraints";
import { ProjectControlData, Task, TaskPriority } from "./types";
import { makeEntityId } from "./utils";

export interface OutboxSyncResult {
  data: ProjectControlData;
  createdTasks: Task[];
}

function inferPriority(text: string): TaskPriority {
  const lowered = text.toLowerCase();
  if (lowered.includes("high") || lowered.includes("critical") || lowered.includes("urgent")) {
    return "high";
  }
  if (lowered.includes("low") || lowered.includes("minor")) {
    return "low";
  }
  return "medium";
}

function extractTaskLines(outbox: string): string[] {
  return outbox
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /^\d+\.\s+/.test(line) || /^-\s+/.test(line))
    .map((line) => line.replace(/^\d+\.\s+/, "").replace(/^-\s+/, "").trim())
    .filter((line) => line.length > 2);
}

export function syncTasksFromOutbox(outbox: string, currentData: ProjectControlData): OutboxSyncResult {
  const lines = extractTaskLines(outbox);
  const createdTasks: Task[] = [];
  const knownTitles = new Set(currentData.tasks.map((task) => task.title.toLowerCase()));

  lines.forEach((line, index) => {
    const cleaned = line.replace(/^\[[^\]]+\]\s*/, "").trim();
    const title = sanitizeTitle(cleaned);
    if (!title || knownTitles.has(title.toLowerCase())) {
      return;
    }
    knownTitles.add(title.toLowerCase());
    const ts = Date.now() + index;
    createdTasks.push({
      id: makeEntityId("task"),
      title,
      priority: inferPriority(line),
      status: "todo",
      description: `Imported from agent outbox:\n\n${line}`,
      links: [],
      checklist: [],
      createdAt: ts,
      updatedAt: ts
    });
  });

  const nextData: ProjectControlData = {
    ...currentData,
    tasks: [...createdTasks, ...currentData.tasks],
    activity: [
      {
        id: makeEntityId("act"),
        type: "outbox_sync",
        message: `Synced ${createdTasks.length} task(s) from agent outbox.`,
        ts: Date.now()
      },
      ...currentData.activity
    ]
  };

  return { data: nextData, createdTasks };
}
