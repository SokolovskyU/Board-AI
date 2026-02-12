import * as vscode from "vscode";
import { TextDecoder, TextEncoder } from "util";
import { ActivityItem, ProjectControlData, Task, TaskStatus } from "./types";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const ROOT_DIR = ".project-control";
const DOCS_DIR = "docs";
const DATA_FILE = "data.json";
const AGENT_CONTRACT_FILE = "AGENT_CONTRACT.md";
const AGENT_INBOX_FILE = "agent_inbox.md";
const AGENT_OUTBOX_FILE = "agent_outbox.md";

const DEFAULT_DOC = `# Project Notes

Use this document as the main project context.
`;

const DEFAULT_CONTRACT = `# Agent Contract

This file defines how the coding agent should update Project Control.

## Inputs
- Read planning instructions from \`.project-control/agent_inbox.md\`.
- Convert user intent into actionable tasks.

## Task Creation Rules
- Create clear task titles focused on concrete outcomes.
- Set priority as \`low\`, \`medium\`, or \`high\`.
- Use \`todo\` for ready tasks, \`backlog\` for deferred tasks.
- Fill \`description\` with execution details.
- Add \`checklist\` steps for implementation and verification.
- Add \`links\` only when there is a concrete workspace reference.

## Status Rules
- Move to \`inprogress\` when work starts.
- Move to \`done\` only after implementation and validation.
- Keep unfinished items in \`todo\` or \`backlog\`.

## Activity Rules
- Log major lifecycle events in global activity.
- Add task-specific activity with \`taskId\` for status changes and key updates.
- Use short factual messages with timestamps.

## Outputs
- Write concise plan/results into \`.project-control/agent_outbox.md\`.
- Keep board state in \`.project-control/data.json\` as source of truth.
`;

const DEFAULT_INBOX = `# Agent Inbox

Write planning prompt here. Then run: Project Control: Ingest Prompt
`;

const DEFAULT_OUTBOX = `# Agent Outbox

No processed prompt yet.
`;

function now(): number {
  return Date.now();
}

function makeId(prefix: string): string {
  return `${prefix}_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

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
            title: typeof typed.title === "string" ? typed.title : "Untitled task",
            priority,
            status,
            description: typeof typed.description === "string" ? typed.description : "",
            links: Array.isArray(typed.links)
              ? typed.links
                  .filter((link) => link && typeof link === "object")
                  .map((link) => ({
                    label: typeof link.label === "string" ? link.label : "Link",
                    href: typeof link.href === "string" ? link.href : "#"
                  }))
              : [],
            checklist: Array.isArray(typed.checklist)
              ? typed.checklist
                  .filter((item) => item && typeof item === "object")
                  .map((item) => ({
                    id: typeof item.id === "string" ? item.id : makeId("check"),
                    text: typeof item.text === "string" ? item.text : "",
                    done: Boolean(item.done)
                  }))
              : [],
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

export class ProjectControlStorage {
  constructor(private readonly workspaceRoot: vscode.Uri) {}

  getRootUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.workspaceRoot, ROOT_DIR);
  }

  getDataUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.getRootUri(), DATA_FILE);
  }

  getDocsDirUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.getRootUri(), DOCS_DIR);
  }

  getDocUri(name: string): vscode.Uri {
    return vscode.Uri.joinPath(this.getDocsDirUri(), name);
  }

  getAgentInboxUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.getRootUri(), AGENT_INBOX_FILE);
  }

  getAgentOutboxUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.getRootUri(), AGENT_OUTBOX_FILE);
  }

  private async ensureDir(uri: vscode.Uri): Promise<void> {
    await vscode.workspace.fs.createDirectory(uri);
  }

  async ensureStructure(): Promise<void> {
    await this.ensureDir(this.getRootUri());
    await this.ensureDir(this.getDocsDirUri());
    await this.ensureFile(this.getDataUri(), JSON.stringify(emptyData(), null, 2));
    await this.ensureFile(this.getAgentInboxUri(), DEFAULT_INBOX);
    await this.ensureFile(this.getAgentOutboxUri(), DEFAULT_OUTBOX);
    await this.ensureFile(vscode.Uri.joinPath(this.getRootUri(), AGENT_CONTRACT_FILE), DEFAULT_CONTRACT);
  }

  private async ensureFile(uri: vscode.Uri, content: string): Promise<void> {
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      await this.writeText(uri, content);
    }
  }

  async loadData(): Promise<ProjectControlData> {
    await this.ensureStructure();
    try {
      const bytes = await vscode.workspace.fs.readFile(this.getDataUri());
      const parsed = JSON.parse(decoder.decode(bytes)) as unknown;
      return normalizeData(parsed);
    } catch {
      return emptyData();
    }
  }

  async saveData(data: ProjectControlData): Promise<void> {
    await this.writeText(this.getDataUri(), JSON.stringify(normalizeData(data), null, 2));
  }

  async listDocs(): Promise<string[]> {
    await this.ensureStructure();
    const docsDir = this.getDocsDirUri();
    const items = await vscode.workspace.fs.readDirectory(docsDir);
    return items
      .filter(([name, fileType]) => fileType === vscode.FileType.File && name.toLowerCase().endsWith(".md"))
      .map(([name]) => name)
      .sort((a, b) => a.localeCompare(b));
  }

  async readDoc(name: string): Promise<string> {
    const uri = this.getDocUri(name);
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      return decoder.decode(bytes);
    } catch {
      const seeded = `# ${name}\n\n`;
      await this.writeDoc(name, seeded);
      return seeded;
    }
  }

  async writeDoc(name: string, content: string): Promise<void> {
    const safeName = sanitizeDocName(name);
    await this.writeText(this.getDocUri(safeName), content);
  }

  async readInbox(): Promise<string> {
    const bytes = await vscode.workspace.fs.readFile(this.getAgentInboxUri());
    return decoder.decode(bytes);
  }

  async writeOutbox(content: string): Promise<void> {
    await this.writeText(this.getAgentOutboxUri(), content);
  }

  async appendActivity(
    data: ProjectControlData,
    type: string,
    message: string,
    taskId?: string
  ): Promise<ProjectControlData> {
    const next = normalizeData(data);
    next.activity.unshift({
      id: makeId("act"),
      type,
      message,
      ts: now(),
      taskId
    });
    await this.saveData(next);
    return next;
  }

  async writeText(uri: vscode.Uri, content: string): Promise<void> {
    const parent = uri.with({ path: uri.path.slice(0, Math.max(0, uri.path.lastIndexOf("/"))) });
    if (parent.path) {
      await this.ensureDir(parent);
    }
    await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
  }
}

export function sanitizeDocName(name: string): string {
  const normalized = name.trim().replace(/[\\/:*?"<>|]/g, "-");
  if (!normalized) {
    return "notes.md";
  }
  return normalized.toLowerCase().endsWith(".md") ? normalized : `${normalized}.md`;
}

export function createTaskActivityMessage(title: string, status: TaskStatus): string {
  if (status === "inprogress") {
    return `Task started: ${title}`;
  }
  if (status === "done") {
    return `Task completed: ${title}`;
  }
  return `Task moved to ${status}: ${title}`;
}

export function makeEntityId(prefix: string): string {
  return makeId(prefix);
}
