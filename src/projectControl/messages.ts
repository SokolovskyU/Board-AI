import {
  MAX_CHECKLIST_ITEMS_PER_TASK,
  sanitizeChecklistText,
  sanitizeDescription,
  sanitizeDocContent,
  sanitizeLinks,
  sanitizeTitle
} from "./constraints";
import { makeEntityId, sanitizeDocName } from "./utils";
import { ProjectControlData, Task, TaskStatus } from "./types";

type MessageWithType = { type?: unknown; [key: string]: unknown };

export interface DataMessageResult {
  handled: boolean;
  data: ProjectControlData;
  docWrite?: {
    name: string;
    content: string;
  };
  notice?: {
    kind: "info" | "error" | "success";
    message: string;
  };
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === "backlog" || value === "todo" || value === "inprogress" || value === "done";
}

function activity(
  data: ProjectControlData,
  type: string,
  message: string,
  taskId?: string,
  now = Date.now()
): void {
  data.activity.unshift({
    id: makeEntityId("act"),
    type,
    message,
    ts: now,
    taskId
  });
}

export function processDataMessage(inputData: ProjectControlData, message: MessageWithType): DataMessageResult {
  const data: ProjectControlData = {
    ...inputData,
    tasks: [...inputData.tasks],
    activity: [...inputData.activity]
  };

  if (!message || typeof message !== "object" || typeof message.type !== "string") {
    return { handled: false, data };
  }

  switch (message.type) {
    case "createTask": {
      const typed = message as { title?: unknown };
      const title = sanitizeTitle(typed.title);
      const ts = Date.now();
      const task: Task = {
        id: makeEntityId("task"),
        title,
        priority: "medium",
        status: "todo",
        description: "",
        links: [],
        checklist: [],
        createdAt: ts,
        updatedAt: ts
      };
      data.tasks.unshift(task);
      activity(data, "task_created", `Task created: ${title}`, task.id, ts);
      return { handled: true, data };
    }
    case "updateTask": {
      const typed = message as {
        taskId?: unknown;
        patch?: {
          title?: unknown;
          priority?: unknown;
          description?: unknown;
          links?: unknown;
        };
      };
      const task = data.tasks.find((item) => item.id === typed.taskId);
      if (!task || !typed.patch || typeof typed.patch !== "object") {
        return { handled: false, data };
      }
      if (typeof typed.patch.title === "string") {
        task.title = sanitizeTitle(typed.patch.title);
      }
      if (
        typed.patch.priority === "low" ||
        typed.patch.priority === "medium" ||
        typed.patch.priority === "high"
      ) {
        task.priority = typed.patch.priority;
      }
      if (typeof typed.patch.description === "string") {
        task.description = sanitizeDescription(typed.patch.description);
      }
      let droppedLinks = 0;
      if (Array.isArray(typed.patch.links)) {
        const rawCount = typed.patch.links.length;
        task.links = sanitizeLinks(typed.patch.links);
        droppedLinks = rawCount - task.links.length;
      }
      task.updatedAt = Date.now();
      activity(data, "task_updated", `Task updated: ${task.title}`, task.id, task.updatedAt);
      return {
        handled: true,
        data,
        notice:
          droppedLinks > 0
            ? {
                kind: "info",
                message: `${droppedLinks} invalid or duplicate link(s) were ignored.`
              }
            : undefined
      };
    }
    case "deleteTask": {
      const typed = message as { taskId?: unknown };
      const task = data.tasks.find((item) => item.id === typed.taskId);
      if (!task) {
        return { handled: false, data };
      }
      data.tasks = data.tasks.filter((item) => item.id !== typed.taskId);
      activity(data, "task_deleted", `Task deleted: ${task.title}`, task.id);
      return {
        handled: true,
        data,
        notice: { kind: "success", message: `Deleted task: ${task.title}` }
      };
    }
    case "moveTask": {
      const typed = message as { id?: unknown; status?: unknown };
      const task = data.tasks.find((item) => item.id === typed.id);
      if (!task || !isTaskStatus(typed.status) || task.status === typed.status) {
        return { handled: false, data };
      }
      task.status = typed.status;
      task.updatedAt = Date.now();
      const statusMessage =
        typed.status === "inprogress"
          ? `Task started: ${task.title}`
          : typed.status === "done"
            ? `Task completed: ${task.title}`
            : `Task moved to ${typed.status}: ${task.title}`;
      activity(data, "task_status", statusMessage, task.id, task.updatedAt);
      return {
        handled: true,
        data,
        notice: { kind: "success", message: "Checklist item added." }
      };
    }
    case "toggleChecklist": {
      const typed = message as { taskId?: unknown; checklistId?: unknown; done?: unknown };
      const task = data.tasks.find((item) => item.id === typed.taskId);
      if (!task) {
        return { handled: false, data };
      }
      const checklistItem = task.checklist.find((item) => item.id === typed.checklistId);
      if (!checklistItem) {
        return { handled: false, data };
      }
      checklistItem.done = Boolean(typed.done);
      task.updatedAt = Date.now();
      activity(
        data,
        "checklist_toggle",
        `Checklist ${checklistItem.done ? "completed" : "reopened"}: ${checklistItem.text}`,
        task.id,
        task.updatedAt
      );
      return {
        handled: true,
        data,
        notice: { kind: "success", message: "Checklist item removed." }
      };
    }
    case "addChecklistItem": {
      const typed = message as { taskId?: unknown; text?: unknown };
      const task = data.tasks.find((item) => item.id === typed.taskId);
      const text = sanitizeChecklistText(typed.text);
      if (!task || !text) {
        return {
          handled: false,
          data,
          notice: { kind: "error", message: "Checklist item is empty or invalid." }
        };
      }
      const exists = task.checklist.some((item) => item.text.toLowerCase() === text.toLowerCase());
      if (exists) {
        return {
          handled: false,
          data,
          notice: { kind: "error", message: "Checklist item already exists." }
        };
      }
      if (task.checklist.length >= MAX_CHECKLIST_ITEMS_PER_TASK) {
        return {
          handled: false,
          data,
          notice: {
            kind: "error",
            message: `Checklist limit reached (${MAX_CHECKLIST_ITEMS_PER_TASK}).`
          }
        };
      }
      task.checklist.push({
        id: makeEntityId("check"),
        text,
        done: false
      });
      task.updatedAt = Date.now();
      activity(data, "checklist_added", `Checklist item added: ${text}`, task.id, task.updatedAt);
      return { handled: true, data };
    }
    case "removeChecklistItem": {
      const typed = message as { taskId?: unknown; checklistId?: unknown };
      const task = data.tasks.find((item) => item.id === typed.taskId);
      if (!task) {
        return { handled: false, data };
      }
      const existing = task.checklist.find((item) => item.id === typed.checklistId);
      if (!existing) {
        return { handled: false, data };
      }
      task.checklist = task.checklist.filter((item) => item.id !== typed.checklistId);
      task.updatedAt = Date.now();
      activity(data, "checklist_removed", `Checklist item removed: ${existing.text}`, task.id, task.updatedAt);
      return { handled: true, data };
    }
    case "saveMainDoc": {
      const typed = message as { content?: unknown };
      data.docMarkdown = sanitizeDocContent(typed.content);
      activity(data, "doc_saved", "Main document saved.");
      return { handled: true, data };
    }
    case "saveDoc": {
      const typed = message as { name?: unknown; content?: unknown };
      const name = sanitizeDocName(typeof typed.name === "string" ? typed.name : "");
      const content = sanitizeDocContent(typed.content);
      activity(data, "doc_saved", `Document saved: ${name}`);
      return {
        handled: true,
        data,
        docWrite: {
          name,
          content
        }
      };
    }
    default:
      return { handled: false, data };
  }
}
