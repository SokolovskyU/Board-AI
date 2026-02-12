import { makeEntityId, sanitizeDocName } from "./storage";
import { ProjectControlData, Task, TaskStatus } from "./types";

type MessageWithType = { type?: unknown; [key: string]: unknown };

export interface DataMessageResult {
  handled: boolean;
  data: ProjectControlData;
  docWrite?: {
    name: string;
    content: string;
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
      const title = typeof typed.title === "string" && typed.title.trim() ? typed.title.trim() : "New task";
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
      if (typeof typed.patch.title === "string" && typed.patch.title.trim()) {
        task.title = typed.patch.title.trim();
      }
      if (
        typed.patch.priority === "low" ||
        typed.patch.priority === "medium" ||
        typed.patch.priority === "high"
      ) {
        task.priority = typed.patch.priority;
      }
      if (typeof typed.patch.description === "string") {
        task.description = typed.patch.description;
      }
      if (Array.isArray(typed.patch.links)) {
        task.links = typed.patch.links
          .filter((link) => link && typeof link === "object")
          .map((link) => {
            const typedLink = link as { label?: unknown; href?: unknown };
            return {
              label: typeof typedLink.label === "string" ? typedLink.label : "Link",
              href: typeof typedLink.href === "string" ? typedLink.href : ""
            };
          })
          .filter((link) => Boolean(link.href));
      }
      task.updatedAt = Date.now();
      activity(data, "task_updated", `Task updated: ${task.title}`, task.id, task.updatedAt);
      return { handled: true, data };
    }
    case "deleteTask": {
      const typed = message as { taskId?: unknown };
      const task = data.tasks.find((item) => item.id === typed.taskId);
      if (!task) {
        return { handled: false, data };
      }
      data.tasks = data.tasks.filter((item) => item.id !== typed.taskId);
      activity(data, "task_deleted", `Task deleted: ${task.title}`, task.id);
      return { handled: true, data };
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
      return { handled: true, data };
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
      return { handled: true, data };
    }
    case "addChecklistItem": {
      const typed = message as { taskId?: unknown; text?: unknown };
      const task = data.tasks.find((item) => item.id === typed.taskId);
      const text = typeof typed.text === "string" ? typed.text.trim() : "";
      if (!task || !text) {
        return { handled: false, data };
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
      data.docMarkdown = typeof typed.content === "string" ? typed.content : "";
      activity(data, "doc_saved", "Main document saved.");
      return { handled: true, data };
    }
    case "saveDoc": {
      const typed = message as { name?: unknown; content?: unknown };
      const name = sanitizeDocName(typeof typed.name === "string" ? typed.name : "");
      const content = typeof typed.content === "string" ? typed.content : "";
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
