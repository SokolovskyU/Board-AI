import { ProjectControlData, Task, TaskPriority } from "./types";
import { normalizeData } from "./dataModel";
import { makeEntityId } from "./utils";

function inferPriority(line: string): TaskPriority {
  const lower = line.toLowerCase();
  if (lower.includes("urgent") || lower.includes("critical") || lower.includes("high")) {
    return "high";
  }
  if (lower.includes("low") || lower.includes("minor") || lower.includes("nice to have")) {
    return "low";
  }
  return "medium";
}

function cleanTitle(input: string): string {
  return input.replace(/^[-*]\s*/, "").trim().replace(/\s+/g, " ");
}

function toChecklist(text: string): Task["checklist"] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- [ ]") || line.startsWith("* [ ]"))
    .map((line) => line.replace(/^[-*]\s+\[\s\]\s*/, "").trim())
    .filter(Boolean);

  return lines.map((item) => ({
    id: makeEntityId("check"),
    text: item,
    done: false
  }));
}

function extractCandidateLines(prompt: string): string[] {
  const bulletLines = prompt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map(cleanTitle)
    .filter((line) => line.length > 3);
  if (bulletLines.length > 0) {
    return bulletLines;
  }

  return prompt
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 10)
    .flatMap((line) => line.split(/[.;]/))
    .map((line) => line.trim())
    .filter((line) => line.length > 10)
    .slice(0, 8);
}

export interface IngestResult {
  data: ProjectControlData;
  createdTasks: Task[];
  summary: string;
}

export function ingestPromptToTasks(prompt: string, currentData: ProjectControlData): IngestResult {
  const base = normalizeData(currentData);
  const lines = extractCandidateLines(prompt);
  const timestamp = Date.now();

  const createdTasks: Task[] = lines.map((line, index) => {
    const title = cleanTitle(line).slice(0, 120) || `Task ${index + 1}`;
    return {
      id: makeEntityId("task"),
      title,
      priority: inferPriority(line),
      status: "todo",
      description: `Execution details:\n\n${line}`,
      links: [],
      checklist: toChecklist(prompt),
      createdAt: timestamp + index,
      updatedAt: timestamp + index
    };
  });

  base.tasks = [...createdTasks, ...base.tasks];
  base.activity.unshift({
    id: makeEntityId("act"),
    type: "ingest",
    message: `Ingested prompt into ${createdTasks.length} task(s).`,
    ts: Date.now()
  });

  const summaryLines = createdTasks.length
    ? createdTasks.map((task, index) => `${index + 1}. [${task.priority}] ${task.title}`)
    : ["No clear task candidates were found in inbox prompt."];

  const summary = `# Agent Outbox

Ingested at: ${new Date().toISOString()}

Created tasks:
${summaryLines.join("\n")}
`;

  return {
    data: base,
    createdTasks,
    summary
  };
}
