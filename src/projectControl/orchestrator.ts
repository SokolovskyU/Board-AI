import { ProjectControlData, Task, TaskOwner } from "./types";
import { makeEntityId } from "./utils";

export interface OrchestratorResult {
  data: ProjectControlData;
  message: string;
}

const queueOrder: TaskOwner[] = ["builder", "qa", "scribe", "planner"];

function logActivity(data: ProjectControlData, type: string, message: string, taskId?: string): void {
  data.activity.unshift({
    id: makeEntityId("act"),
    type,
    message,
    ts: Date.now(),
    taskId
  });
}

function findNextTodo(tasks: Task[]): Task | undefined {
  for (const owner of queueOrder) {
    const task = tasks.find((item) => item.status === "todo" && item.owner === owner);
    if (task) {
      return task;
    }
  }
  return tasks.find((item) => item.status === "todo");
}

export function runMultiAgentCycle(input: ProjectControlData): OrchestratorResult {
  const data: ProjectControlData = {
    ...input,
    tasks: [...input.tasks],
    activity: [...input.activity]
  };

  const inProgress = data.tasks.filter((task) => task.status === "inprogress");
  if (inProgress.length > 1) {
    return {
      data,
      message: "Cycle paused: more than one task is in progress."
    };
  }

  if (inProgress.length === 1) {
    const task = inProgress[0];
    task.updatedAt = Date.now();
    if (task.owner === "builder") {
      task.status = "todo";
      task.owner = "qa";
      logActivity(data, "orchestrator_handoff", `Builder -> QA: ${task.title}`, task.id);
      return { data, message: `Handed off to QA: ${task.title}` };
    }
    if (task.owner === "qa") {
      task.status = "todo";
      task.owner = "scribe";
      logActivity(data, "orchestrator_handoff", `QA -> Scribe: ${task.title}`, task.id);
      return { data, message: `Handed off to Scribe: ${task.title}` };
    }
    if (task.owner === "scribe") {
      task.status = "done";
      logActivity(data, "orchestrator_done", `Task completed by Scribe: ${task.title}`, task.id);
      return { data, message: `Completed: ${task.title}` };
    }

    task.owner = "builder";
    task.status = "todo";
    logActivity(data, "orchestrator_handoff", `Planner queued task for Builder: ${task.title}`, task.id);
    return { data, message: `Queued for Builder: ${task.title}` };
  }

  const next = findNextTodo(data.tasks);
  if (!next) {
    return { data, message: "No todo tasks in queue." };
  }
  next.status = "inprogress";
  next.updatedAt = Date.now();
  logActivity(data, "orchestrator_start", `${next.owner.toUpperCase()} started: ${next.title}`, next.id);
  return { data, message: `Started: ${next.title} (${next.owner})` };
}
