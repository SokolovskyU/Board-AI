# Agent Contract

This repository uses Project Control as a visual layer for execution state.

## How the Agent Creates Tasks
- Read planning input from `.project-control/agent_inbox.md`.
- Split intent into concrete, outcome-focused tasks.
- Keep titles short and actionable.
- Set priority (`low`, `medium`, `high`) using urgency and impact.

## Execution Details
- Store execution notes in task `description`.
- Keep `checklist` as implementation + validation steps.
- Add `links` for useful local artifacts (files, docs, issues).

## Status Lifecycle
- `todo`: task is ready to start.
- `inprogress`: actively being implemented.
- `done`: implementation and checks completed.
- `backlog`: deferred work.

## Activity Logging
- Write global activity for meaningful events (ingest, doc updates, major progress).
- Write task activity (with `taskId`) for status moves and key task changes.
- Messages should be factual and brief.

## Outbox Behavior
- After planning or ingestion, write a concise summary to `.project-control/agent_outbox.md`.
- Keep board state in `.project-control/data.json` as source of truth.
