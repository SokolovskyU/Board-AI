export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "backlog" | "todo" | "inprogress" | "done";
export type TaskOwner = "planner" | "builder" | "qa" | "scribe";

export interface TaskLink {
  label: string;
  href: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  owner: TaskOwner;
  description: string;
  links: TaskLink[];
  checklist: ChecklistItem[];
  createdAt: number;
  updatedAt: number;
}

export interface ActivityItem {
  id: string;
  type: string;
  message: string;
  ts: number;
  taskId?: string;
}

export interface ProjectControlData {
  version: 1;
  tasks: Task[];
  docMarkdown: string;
  activity: ActivityItem[];
}

export interface DocFile {
  name: string;
  content: string;
}
