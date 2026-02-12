# Project Control (board-ai)

Project Control is a VS Code webview app that visualizes agent execution inside the current workspace.

Key idea:
- Codex chat (right panel) remains the main control interface.
- Project Control shows board/docs/activity state and task details.

## Features (v0.1)

- Command: `Project Control: Open`
- Command: `Project Control: Ingest Prompt`
- Auto-open on workspace start (once per session), controlled by `projectControl.autoOpen`.
- Webview tabs: `Board`, `Docs`, `Activity`.
- Board columns: `Backlog`, `To Do`, `In Progress`, `Done`.
- Drag and drop tasks across columns.
- Search + priority filter (`all/low/medium/high`).
- Task Details right side panel:
  - title, priority, status
  - markdown description preview
  - links
  - checklist toggle
  - mini activity
  - actions: Edit / Delete / Start / Complete
- Docs:
  - main markdown document (stored in data.json)
  - additional docs from `.project-control/docs/*.md`
- Global activity feed with timestamps.

## Storage Layout

All state is stored in workspace-local files:

- `.project-control/data.json` - source of truth for tasks, main doc markdown, activity
- `.project-control/docs/*.md` - additional markdown docs
- `.project-control/AGENT_CONTRACT.md` - rules for agent updates
- `.project-control/agent_inbox.md` - prompt input for planning
- `.project-control/agent_outbox.md` - concise plan/result output

Data schema (`.project-control/data.json`):

```json
{
  "version": 1,
  "tasks": [
    {
      "id": "string",
      "title": "string",
      "priority": "low|medium|high",
      "status": "backlog|todo|inprogress|done",
      "description": "string",
      "links": [{ "label": "string", "href": "string" }],
      "checklist": [{ "id": "string", "text": "string", "done": false }],
      "createdAt": 0,
      "updatedAt": 0
    }
  ],
  "docMarkdown": "string",
  "activity": [{ "id": "string", "type": "string", "message": "string", "ts": 0, "taskId": "string" }]
}
```

## Agent Contract Workflow

1. Put a planning prompt into `.project-control/agent_inbox.md`.
2. Run `Project Control: Ingest Prompt`.
3. Extension parses text locally (no network calls), creates tasks in `data.json`, writes summary into `agent_outbox.md`, and logs activity.
4. Agent/Codex continues updating task status/details during execution.

## Development

```bash
npm install
npm run compile
```

Then run extension in VS Code debugger (`F5`).

## 2-minute Manual Check

1. Run `npm run compile`.
2. Press `F5` to launch Extension Development Host.
3. Open any folder workspace. Ensure `Project Control` opens automatically (if `projectControl.autoOpen=true`).
4. In Command Palette run `Project Control: Open` and verify tabs `Board/Docs/Activity`.
5. On Board: create a task, drag it to `In Progress`, click task and press `Complete`.
6. Verify task change appears in Activity and in `.project-control/data.json`.
7. In Docs: edit main doc and save; create `notes.md`, save it, reopen from doc list.
8. Put text into `.project-control/agent_inbox.md`, run `Project Control: Ingest Prompt`, verify new tasks + `.project-control/agent_outbox.md`.
