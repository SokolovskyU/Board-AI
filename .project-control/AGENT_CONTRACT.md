# Agent Contract

Project Control is the execution tracker for Codex work in this repository.

## Main Rule
- Codex chat is the control interface.
- Project Control board/docs/activity must reflect real execution state.
- Work in two phases:
  1) Build/update the full `todo` queue first.
  2) Execute tasks one by one: `todo -> inprogress -> done`.
- Keep only one task in `inprogress` unless user explicitly asks for parallel execution.

## Task Creation
- Read planning intent from `.project-control/agent_inbox.md` or the current user request.
- Split work into concrete tasks with clear outcomes.
- Keep task titles short and actionable.
- Set priority: `low` / `medium` / `high`.
- Assign `owner` role: `planner`, `builder`, `qa`, `scribe`.
- Write task `description` in Russian with practical implementation details.
- Keep checklist items in Russian and outcome-oriented.

## Required Status Flow
- New actionable task: `todo`.
- When implementation starts: move to `inprogress`.
- After implementation + verification: move to `done`.
- Deferred work only: `backlog`.
- The board should always show:
  - what is planned (`todo`)
  - what is being executed now (`inprogress`)
  - what is finished (`done`)

## Execution Details
- Update `description` and `checklist` while working.
- Keep links relevant and valid (`https://` / `http://` / `mailto:`).
- Use task details to explain what was done, not just what is planned.

## Activity Logging
- Log global activity for key events.
- Log task activity (`taskId`) for status changes and major updates.
- Messages should be short, factual, and in Russian when possible.

## Outbox Behavior
- Write concise plan/results to `.project-control/agent_outbox.md`.
- Keep `.project-control/data.json` as the single source of truth.
