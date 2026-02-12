import {
  sanitizeChecklist,
  sanitizeDescription,
  sanitizeLinks,
  sanitizeTitle
} from "./constraints";
import { repairCommonMojibake } from "./encoding";
import { ActivityItem, ProjectControlData, Task, TaskOwner, TaskStatus } from "./types";

function now(): number {
  return Date.now();
}

function makeId(prefix: string): string {
  return `${prefix}_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_DOC = `# Project Notes

Use this document as the main project context.
`;

export function emptyData(): ProjectControlData {
  return {
    version: 1,
    tasks: [],
    docMarkdown: DEFAULT_DOC,
    activity: []
  };
}

export function normalizeData(input: unknown): ProjectControlData {
  const fallback = emptyData();
  if (!input || typeof input !== "object") {
    return fallback;
  }

  const raw = input as Partial<ProjectControlData>;
  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks
        .map((task): Task | null => {
          if (!task || typeof task !== "object") {
            return null;
          }

          const typed = task as Partial<Task>;
          const createdAt = typeof typed.createdAt === "number" ? typed.createdAt : now();
          const updatedAt = typeof typed.updatedAt === "number" ? typed.updatedAt : createdAt;
          const status: TaskStatus =
            typed.status === "backlog" ||
            typed.status === "todo" ||
            typed.status === "inprogress" ||
            typed.status === "done"
              ? typed.status
              : "todo";
          const priority =
            typed.priority === "low" || typed.priority === "medium" || typed.priority === "high"
              ? typed.priority
              : "medium";
          const owner: TaskOwner =
            typed.owner === "planner" ||
            typed.owner === "builder" ||
            typed.owner === "qa" ||
            typed.owner === "scribe"
              ? typed.owner
              : "builder";

          return {
            id: typeof typed.id === "string" ? typed.id : makeId("task"),
            title: sanitizeTitle(repairCommonMojibake(typeof typed.title === "string" ? typed.title : "")),
            priority,
            status,
            owner,
            description: sanitizeDescription(
              repairCommonMojibake(typeof typed.description === "string" ? typed.description : "")
            ),
            links: sanitizeLinks(typed.links).map((link) => ({
              label: repairCommonMojibake(link.label),
              href: link.href
            })),
            checklist: sanitizeChecklist(typed.checklist).map((item) => ({
              ...item,
              text: repairCommonMojibake(item.text),
              id: item.id || makeId("check")
            })),
            createdAt,
            updatedAt
          };
        })
        .filter((task): task is Task => task !== null)
    : [];

  const activity = Array.isArray(raw.activity)
    ? raw.activity
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const typed = item as Partial<ActivityItem>;
          return {
            id: typeof typed.id === "string" ? typed.id : makeId("act"),
            type: typeof typed.type === "string" ? typed.type : "note",
            message: repairCommonMojibake(typeof typed.message === "string" ? typed.message : ""),
            ts: typeof typed.ts === "number" ? typed.ts : now(),
            taskId: typeof typed.taskId === "string" ? typed.taskId : undefined
          };
        })
    : [];

  return {
    version: 1,
    tasks,
    docMarkdown:
      typeof raw.docMarkdown === "string"
        ? repairCommonMojibake(raw.docMarkdown)
        : fallback.docMarkdown,
    activity
  };
}
