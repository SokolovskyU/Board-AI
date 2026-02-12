import * as vscode from "vscode";
import { ingestPromptToTasks } from "./projectControl/ingest";
import {
  ProjectControlStorage,
  createTaskActivityMessage,
  makeEntityId,
  normalizeData,
  sanitizeDocName
} from "./projectControl/storage";
import { ProjectControlData, Task, TaskStatus } from "./projectControl/types";
import { getProjectControlHtml } from "./projectControl/webview";

let currentPanel: vscode.WebviewPanel | undefined;
let sessionAutoOpened = false;
let extensionCtx: vscode.ExtensionContext | undefined;

export function activate(context: vscode.ExtensionContext): void {
  extensionCtx = context;
  const openDisposable = vscode.commands.registerCommand("projectControl.open", async () => {
    await openProjectControlPanel(context, true);
  });

  const ingestDisposable = vscode.commands.registerCommand("projectControl.ingestPrompt", async () => {
    const storage = getStorageOrNotify(true);
    if (!storage) {
      return;
    }

    const data = await storage.loadData();
    const inbox = await storage.readInbox();
    const ingest = ingestPromptToTasks(inbox, data);
    await storage.saveData(ingest.data);
    await storage.writeOutbox(ingest.summary);
    vscode.window.showInformationMessage(
      `Project Control: created ${ingest.createdTasks.length} task(s) from agent inbox.`
    );
    postStateUpdate(storage, ingest.data);
  });

  context.subscriptions.push(openDisposable, ingestDisposable);

  const autoOpen = vscode.workspace.getConfiguration("projectControl").get<boolean>("autoOpen", true);
  if (autoOpen && !sessionAutoOpened) {
    sessionAutoOpened = true;
    void openProjectControlPanel(context, false);
  }
}

async function openProjectControlPanel(
  context: vscode.ExtensionContext,
  notifyOnMissingWorkspace: boolean
): Promise<void> {
  const storage = getStorageOrNotify(notifyOnMissingWorkspace);
  if (!storage) {
    return;
  }

  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  const panel = vscode.window.createWebviewPanel("projectControl", "Project Control", vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: true
  });
  currentPanel = panel;
  panel.webview.html = getProjectControlHtml(panel.webview);

  panel.onDidDispose(() => {
    if (currentPanel === panel) {
      currentPanel = undefined;
    }
  });

  panel.webview.onDidReceiveMessage(async (message) => {
    await handleWebviewMessage(storage, message);
  });

  const data = await storage.loadData();
  const docs = await storage.listDocs();
  panel.webview.postMessage({ type: "init", data, docs });

  context.subscriptions.push(panel);
}

function getWorkspaceRoot(): vscode.Uri | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri;
}

function getStorageOrNotify(notifyOnMissingWorkspace: boolean): ProjectControlStorage | undefined {
  const workspaceRoot = getWorkspaceRoot();
  if (workspaceRoot) {
    return new ProjectControlStorage(workspaceRoot);
  }

  // Dev Host can start without folder; use extension root as local repo fallback.
  if (extensionCtx?.extensionMode === vscode.ExtensionMode.Development) {
    return new ProjectControlStorage(extensionCtx.extensionUri);
  }

  if (!workspaceRoot) {
    if (notifyOnMissingWorkspace) {
      void vscode.window.showWarningMessage("Project Control requires an opened workspace folder.");
    }
    return undefined;
  }
  return new ProjectControlStorage(workspaceRoot);
}

async function handleWebviewMessage(storage: ProjectControlStorage, message: any): Promise<void> {
  if (!message || typeof message !== "object") {
    return;
  }

  const data = await storage.loadData();

  switch (message.type) {
    case "ready": {
      const docs = await storage.listDocs();
      postInit(storage, data, docs);
      return;
    }
    case "createTask": {
      const title = typeof message.title === "string" && message.title.trim() ? message.title.trim() : "New task";
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
      data.activity.unshift({
        id: makeEntityId("act"),
        type: "task_created",
        message: `Task created: ${title}`,
        ts,
        taskId: task.id
      });
      await storage.saveData(data);
      postStateUpdate(storage, data);
      return;
    }
    case "updateTask": {
      const taskId = typeof message.taskId === "string" ? message.taskId : "";
      const patch = message.patch && typeof message.patch === "object" ? message.patch : {};
      const task = data.tasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }
      if (typeof patch.title === "string" && patch.title.trim()) {
        task.title = patch.title.trim();
      }
      if (patch.priority === "low" || patch.priority === "medium" || patch.priority === "high") {
        task.priority = patch.priority;
      }
      if (typeof patch.description === "string") {
        task.description = patch.description;
      }
      if (Array.isArray(patch.links)) {
        task.links = patch.links
          .filter((link: any) => link && typeof link === "object")
          .map((link: any) => ({
            label: typeof link.label === "string" ? link.label : "Link",
            href: typeof link.href === "string" ? link.href : ""
          }))
          .filter((link: { href: string }) => Boolean(link.href));
      }
      task.updatedAt = Date.now();
      data.activity.unshift({
        id: makeEntityId("act"),
        type: "task_updated",
        message: `Task updated: ${task.title}`,
        ts: task.updatedAt,
        taskId: task.id
      });
      await storage.saveData(data);
      postStateUpdate(storage, data);
      return;
    }
    case "deleteTask": {
      const taskId = typeof message.taskId === "string" ? message.taskId : "";
      const task = data.tasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }
      data.tasks = data.tasks.filter((item) => item.id !== taskId);
      data.activity.unshift({
        id: makeEntityId("act"),
        type: "task_deleted",
        message: `Task deleted: ${task.title}`,
        ts: Date.now(),
        taskId
      });
      await storage.saveData(data);
      postStateUpdate(storage, data);
      return;
    }
    case "moveTask": {
      const taskId = typeof message.id === "string" ? message.id : "";
      const status =
        message.status === "backlog" ||
        message.status === "todo" ||
        message.status === "inprogress" ||
        message.status === "done"
          ? (message.status as TaskStatus)
          : undefined;
      const task = data.tasks.find((item) => item.id === taskId);
      if (!task || !status || task.status === status) {
        return;
      }
      task.status = status;
      task.updatedAt = Date.now();
      data.activity.unshift({
        id: makeEntityId("act"),
        type: "task_status",
        message: createTaskActivityMessage(task.title, status),
        ts: task.updatedAt,
        taskId
      });
      await storage.saveData(data);
      postStateUpdate(storage, data);
      return;
    }
    case "toggleChecklist": {
      const taskId = typeof message.taskId === "string" ? message.taskId : "";
      const checklistId = typeof message.checklistId === "string" ? message.checklistId : "";
      const done = Boolean(message.done);
      const task = data.tasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }
      const checklistItem = task.checklist.find((item) => item.id === checklistId);
      if (!checklistItem) {
        return;
      }
      checklistItem.done = done;
      task.updatedAt = Date.now();
      data.activity.unshift({
        id: makeEntityId("act"),
        type: "checklist_toggle",
        message: `Checklist ${done ? "completed" : "reopened"}: ${checklistItem.text}`,
        ts: task.updatedAt,
        taskId
      });
      await storage.saveData(data);
      postStateUpdate(storage, data);
      return;
    }
    case "saveMainDoc": {
      const content = typeof message.content === "string" ? message.content : "";
      data.docMarkdown = content;
      data.activity.unshift({
        id: makeEntityId("act"),
        type: "doc_saved",
        message: "Main document saved.",
        ts: Date.now()
      });
      await storage.saveData(data);
      postStateUpdate(storage, data);
      return;
    }
    case "readDoc": {
      const name = sanitizeDocName(typeof message.name === "string" ? message.name : "");
      const content = await storage.readDoc(name);
      currentPanel?.webview.postMessage({ type: "docContent", name, content });
      return;
    }
    case "saveDoc": {
      const name = sanitizeDocName(typeof message.name === "string" ? message.name : "");
      const content = typeof message.content === "string" ? message.content : "";
      await storage.writeDoc(name, content);
      data.activity.unshift({
        id: makeEntityId("act"),
        type: "doc_saved",
        message: `Document saved: ${name}`,
        ts: Date.now()
      });
      await storage.saveData(data);
      postStateUpdate(storage, data);
      currentPanel?.webview.postMessage({ type: "docContent", name, content });
      {
        const docs = await storage.listDocs();
        currentPanel?.webview.postMessage({ type: "docsList", docs });
      }
      return;
    }
    default:
      return;
  }
}

function postInit(storage: ProjectControlStorage, data: ProjectControlData, docs: string[]): void {
  const safe = normalizeData(data);
  void storage.saveData(safe);
  currentPanel?.webview.postMessage({ type: "init", data: safe, docs });
}

function postStateUpdate(storage: ProjectControlStorage, data: ProjectControlData): void {
  const safe = normalizeData(data);
  void storage.saveData(safe);
  currentPanel?.webview.postMessage({ type: "state", data: safe });
}
