# Change Log

All notable changes to the "board-ai" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added
- `Project Control: Sync From Outbox` command to import tasks from `.project-control/agent_outbox.md`.
- Activity filters in webview (`All`, `Tasks`, `Docs`, `Agent`).
- Toast notification system for UI feedback.
- Inline validation feedback for invalid links in Task Details.
- CI workflow for compile + unit smoke tests.

### Changed
- Task Details now autosave title/priority/description/links with state indicator.
- Docs autosave status UX refined (`Saved` / `Unsaved` / `Saving...`).
- Data guardrails tightened for titles, links, checklists and docs.
- `npm test` now runs stable unit smoke tests; VS Code integration test remains available as `npm run test:vscode`.
