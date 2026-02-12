import * as vscode from "vscode";
import { ingestPromptToTasks } from "./projectControl/ingest";
import { processDataMessage } from "./projectControl/messages";
import { ProjectControlStorage, normalizeData, sanitizeDocName } from "./projectControl/storage";
import { ProjectControlData } from "./projectControl/types";
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
    case "readDoc": {
      const name = sanitizeDocName(typeof message.name === "string" ? message.name : "");
      const content = await storage.readDoc(name);
      currentPanel?.webview.postMessage({ type: "docContent", name, content });
      return;
    }
    default:
      break;
  }

  const processed = processDataMessage(data, message);
  if (!processed.handled) {
    return;
  }

  if (processed.docWrite) {
    await storage.writeDoc(processed.docWrite.name, processed.docWrite.content);
    currentPanel?.webview.postMessage({
      type: "docContent",
      name: processed.docWrite.name,
      content: processed.docWrite.content
    });
    const docs = await storage.listDocs();
    currentPanel?.webview.postMessage({ type: "docsList", docs });
  }

  await storage.saveData(processed.data);
  postStateUpdate(storage, processed.data);
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
