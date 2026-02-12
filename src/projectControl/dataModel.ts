import {
  sanitizeChecklist,
  sanitizeDescription,
  sanitizeLinks,
  sanitizeTitle
} from "./constraints";
import { ActivityItem, ProjectControlData, Task, TaskStatus } from "./types";

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

          return {
            id: typeof typed.id === "string" ? typed.id : makeId("task"),
            title: sanitizeTitle(typed.title),
            priority,
            status,
            description: sanitizeDescription(typed.description),
            links: sanitizeLinks(typed.links),
            checklist: sanitizeChecklist(typed.checklist).map((item) => ({
              ...item,
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
            message: typeof typed.message === "string" ? typed.message : "",
            ts: typeof typed.ts === "number" ? typed.ts : now(),
            taskId: typeof typed.taskId === "string" ? typed.taskId : undefined
          };
        })
    : [];

  return {
    version: 1,
    tasks,
    docMarkdown: typeof raw.docMarkdown === "string" ? raw.docMarkdown : fallback.docMarkdown,
    activity
  };
}
