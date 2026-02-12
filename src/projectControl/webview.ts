import * as vscode from "vscode";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 24; i += 1) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export function getProjectControlHtml(webview: vscode.Webview): string {
  const scriptNonce = nonce();
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${scriptNonce}'`
  ].join("; ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <title>Project Control</title>
    <style>
      :root {
        --bg: #1a1b26;
        --bg-dark: #16161e;
        --panel: #1f2335;
        --panel-2: #24283b;
        --muted: #a9b1d6;
        --text: #c0caf5;
        --line: #2f3549;
        --accent: #7aa2f7;
        --danger: #f7768e;
        --success: #9ece6a;
        --low: #9ece6a;
        --medium: #e0af68;
        --high: #f7768e;
        --planner: #bb9af7;
        --builder: #7aa2f7;
        --qa: #73daca;
        --scribe: #9ece6a;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", Tahoma, sans-serif;
        background: radial-gradient(circle at top right, #24283b 0%, var(--bg) 48%);
        color: var(--text);
      }
      .app {
        height: 100vh;
        display: grid;
        grid-template-rows: auto 1fr;
      }
      .tabs {
        display: flex;
        gap: 10px;
        padding: 10px 14px;
        border-bottom: 1px solid var(--line);
        background: rgba(26, 27, 38, 0.9);
      }
      .tab {
        border: 1px solid transparent;
        background: transparent;
        color: var(--muted);
        padding: 6px 10px;
        border-radius: 8px;
        cursor: pointer;
      }
      .tab.active {
        color: var(--text);
        border-color: var(--line);
        background: #283457;
      }
      .view { display: none; height: calc(100vh - 54px); overflow: hidden; }
      .view.active { display: block; }
      .board-layout {
        height: 100%;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 340px;
      }
      .board-layout.details-collapsed {
        grid-template-columns: minmax(0, 1fr);
      }
      .board-main { padding: 14px; overflow: auto; }
      .toolbar {
        display: flex;
        gap: 10px;
        margin-bottom: 12px;
      }
      input, select, textarea {
        background: var(--panel);
        color: var(--text);
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 8px 10px;
      }
      textarea { width: 100%; min-height: 90px; resize: vertical; }
      .btn {
        background: #2a3148;
        border: 1px solid var(--line);
        color: var(--text);
        border-radius: 8px;
        padding: 8px 10px;
        cursor: pointer;
      }
      .btn:hover { border-color: #3b4261; }
      .btn.danger { color: #ffd5dc; border-color: #6b2e46; background: #3b2230; }
      .columns {
        display: grid;
        grid-template-columns: repeat(4, minmax(220px, 1fr));
        gap: 10px;
      }
      .col {
        background: rgba(31, 35, 53, 0.95);
        border: 1px solid var(--line);
        border-radius: 10px;
        min-height: 420px;
        padding: 10px;
      }
      .col.drag-over { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
      .col h3 {
        margin: 0 0 10px;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
        display: flex;
        justify-content: space-between;
      }
      .card {
        background: var(--panel-2);
        border: 1px solid #3b4261;
        border-radius: 9px;
        padding: 10px;
        margin-bottom: 8px;
        cursor: pointer;
      }
      .card.dragging { opacity: 0.35; }
      .card-title { font-size: 13px; margin-bottom: 8px; }
      .pill {
        display: inline-block;
        padding: 2px 7px;
        border-radius: 999px;
        font-size: 11px;
        text-transform: uppercase;
      }
      .pill.low { background: rgba(108, 192, 112, 0.2); color: var(--low); }
      .pill.medium { background: rgba(240, 177, 75, 0.2); color: var(--medium); }
      .pill.high { background: rgba(255, 125, 125, 0.2); color: var(--high); }
      .owner-pill {
        display: inline-block;
        margin-left: 6px;
        padding: 2px 7px;
        border-radius: 999px;
        font-size: 10px;
        text-transform: uppercase;
      }
      .owner-pill.planner { background: rgba(187, 154, 247, 0.2); color: var(--planner); }
      .owner-pill.builder { background: rgba(122, 162, 247, 0.2); color: var(--builder); }
      .owner-pill.qa { background: rgba(115, 218, 202, 0.2); color: var(--qa); }
      .owner-pill.scribe { background: rgba(158, 206, 106, 0.2); color: var(--scribe); }
      .details {
        border-left: 1px solid var(--line);
        background: rgba(11, 16, 27, 0.85);
        padding: 14px;
        overflow: auto;
      }
      .board-layout.details-collapsed .details {
        display: none;
      }
      .details h2 { margin: 0 0 8px; }
      .details-head { display: flex; align-items: center; gap: 8px; }
      .close-details-btn {
        margin-left: 8px;
        border: 1px solid var(--line);
        background: var(--panel);
        color: var(--muted);
        border-radius: 6px;
        padding: 2px 8px;
        cursor: pointer;
      }
      .close-details-btn:hover {
        color: var(--text);
        border-color: #3b4261;
      }
      .detail-state { margin-left: auto; font-size: 12px; color: var(--muted); }
      .detail-state.unsaved { color: var(--medium); }
      .detail-state.saving { color: var(--accent); }
      .meta { display: flex; gap: 8px; margin: 8px 0 10px; align-items: center; }
      .details-section { margin-top: 10px; }
      .details-section label {
        display: block;
        margin-bottom: 6px;
        font-size: 12px;
        color: var(--muted);
      }
      .details-error {
        margin-top: 6px;
        font-size: 12px;
        color: #f7768e;
      }
      .detail-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 8px;
        align-items: end;
      }
      .detail-grid .title-field {
        grid-column: 1 / -1;
      }
      .detail-grid input,
      .detail-grid select {
        width: 100%;
        min-width: 0;
      }
      .detail-actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .mini-activity { margin-top: 10px; border-top: 1px solid var(--line); padding-top: 10px; }
      .act-item { font-size: 12px; color: #c0caf5; padding: 6px 0; border-bottom: 1px solid #2f3549; }
      .empty {
        padding: 20px;
        border: 1px dashed var(--line);
        border-radius: 10px;
        color: var(--muted);
      }
      .docs-layout {
        height: 100%;
        display: grid;
        grid-template-columns: 220px minmax(0, 1fr);
      }
      .doc-list {
        border-right: 1px solid var(--line);
        padding: 12px;
        overflow: auto;
      }
      .doc-list button { width: 100%; margin-bottom: 6px; text-align: left; }
      .doc-editor {
        padding: 12px;
        display: grid;
        grid-template-rows: auto 1fr;
        gap: 10px;
      }
      .doc-split {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        min-height: 0;
      }
      .doc-split textarea { min-height: 100%; height: 100%; }
      .preview {
        border: 1px solid var(--line);
        background: var(--panel);
        border-radius: 8px;
        padding: 10px;
        overflow: auto;
      }
      .activity {
        padding: 14px;
        overflow: auto;
      }
      .activity-toolbar {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 10px;
      }
      .activity-card {
        background: rgba(31, 35, 53, 0.95);
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 12px;
        margin-bottom: 10px;
      }
      .link-list a { color: #7dcfff; }
      .check-item { display: flex; gap: 8px; align-items: center; margin: 6px 0; }
      .check-item span { flex: 1; }
      .check-delete {
        border: 1px solid #6b2e46;
        background: #3b2230;
        color: #ffd5dc;
        border-radius: 6px;
        padding: 2px 8px;
        cursor: pointer;
      }
      .check-create { display: grid; grid-template-columns: 1fr auto; gap: 8px; margin-top: 8px; }
      .check-create input {
        min-width: 0;
      }
      .doc-state { font-size: 12px; color: var(--muted); margin-left: auto; }
      .doc-state.unsaved { color: var(--medium); }
      .doc-state.saving { color: var(--accent); }
      .muted { color: var(--muted); }
      .row { display: flex; gap: 8px; }
      .meta {
        flex-wrap: wrap;
      }
      .toasts {
        position: fixed;
        right: 14px;
        bottom: 14px;
        display: grid;
        gap: 8px;
        max-width: 360px;
        z-index: 10;
      }
      .toast {
        background: #24283b;
        border: 1px solid #3b4261;
        border-radius: 8px;
        padding: 8px 10px;
        font-size: 12px;
      }
      .toast.error { border-color: #6b2e46; color: #ffd5dc; }
      .toast.success { border-color: #3f5f3b; color: #d6f1c7; }
    </style>
  </head>
  <body>
    <div class="app">
      <div class="tabs">
        <button class="tab active" data-tab="board" title="Доска задач: план, работа и завершение">Board</button>
        <button class="tab" data-tab="docs" title="Документация проекта">Docs</button>
        <button class="tab" data-tab="activity" title="Лента событий по проекту">Activity</button>
      </div>

      <section id="board-view" class="view active">
        <div class="board-layout">
          <div class="board-main">
            <div class="toolbar">
              <input id="search-input" placeholder="Search tasks..." />
              <select id="priority-filter">
                <option value="all">All priorities</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
              <select id="owner-filter">
                <option value="all">All owners</option>
                <option value="planner">planner</option>
                <option value="builder">builder</option>
                <option value="qa">qa</option>
                <option value="scribe">scribe</option>
              </select>
              <input id="new-task-title" placeholder="New task title..." />
              <button class="btn" id="new-task-btn" title="Создать новую задачу в очереди To Do">New Task</button>
              <button class="btn" id="run-cycle-btn" title="Запустить один шаг мультиагентного цикла">Run Cycle</button>
            </div>
            <div class="columns" id="board-columns"></div>
          </div>
          <aside class="details" id="task-details"></aside>
        </div>
      </section>

      <section id="docs-view" class="view">
        <div class="docs-layout">
          <aside class="doc-list">
            <button class="btn" data-doc="__main__" title="Открыть основной документ">Main Document</button>
            <div id="extra-docs"></div>
            <div class="row">
              <input id="new-doc-name" placeholder="new-doc.md" />
              <button class="btn" id="create-doc-btn" title="Создать новый markdown-документ">+</button>
            </div>
          </aside>
          <div class="doc-editor">
            <div class="row">
              <strong id="doc-title">Main Document</strong>
              <span class="doc-state" id="doc-save-state">Saved</span>
            </div>
            <div class="doc-split">
              <textarea id="doc-editor" spellcheck="false"></textarea>
              <div class="preview" id="doc-preview"></div>
            </div>
          </div>
        </div>
      </section>

      <section id="activity-view" class="view activity">
        <div class="activity-toolbar">
          <select id="activity-filter">
            <option value="all">All activity</option>
            <option value="tasks">Tasks</option>
            <option value="docs">Docs</option>
            <option value="agent">Agent</option>
          </select>
        </div>
        <div id="activity-list"></div>
      </section>
    </div>
    <div class="toasts" id="toasts"></div>

    <script nonce="${scriptNonce}">
      const vscode = acquireVsCodeApi();
      const state = {
        data: { version: 1, tasks: [], docMarkdown: "", activity: [] },
        selectedTaskId: null,
        search: "",
        priorityFilter: "all",
        ownerFilter: "all",
        docs: [],
        selectedDoc: "__main__",
        docDraft: "",
        docDirty: false,
        docSaving: false,
        docSaveTimer: null,
        detailDraft: null,
        detailDirty: false,
        detailSaving: false,
        detailSaveTimer: null,
        activityFilter: "all",
        toasts: [],
        detailsOpen: true
      };
      const DOC_SAVE_DEBOUNCE_MS = 600;
      const DETAIL_SAVE_DEBOUNCE_MS = 500;

      const statusOrder = ["backlog", "todo", "inprogress", "done"];
      const statusLabel = {
        backlog: "Backlog",
        todo: "To Do",
        inprogress: "In Progress",
        done: "Done"
      };

      function markdownToHtml(text) {
        if (!text) return "";
        const escaped = text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return escaped
          .replace(/^### (.*)$/gm, "<h3>$1</h3>")
          .replace(/^## (.*)$/gm, "<h2>$1</h2>")
          .replace(/^# (.*)$/gm, "<h1>$1</h1>")
          .replace(/\\*\\*(.*?)\\*\\*/g, "<strong>$1</strong>")
          .replace(/\\[(.*?)\\]\\((.*?)\\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
          .replace(/^- (.*)$/gm, "<li>$1</li>")
          .replace(/(<li>.*<\\/li>)/gs, "<ul>$1</ul>")
          .replace(/\\n/g, "<br/>");
      }

      function formatTs(ts) {
        return new Date(ts).toLocaleString();
      }

      function showToast(kind, message) {
        const id = "toast_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
        state.toasts.push({ id, kind, message });
        renderToasts();
        setTimeout(() => {
          state.toasts = state.toasts.filter((toast) => toast.id !== id);
          renderToasts();
        }, 2600);
      }

      function renderToasts() {
        const host = document.getElementById("toasts");
        host.innerHTML = state.toasts
          .map((toast) => '<div class="toast ' + (toast.kind || "info") + '">' + toast.message + "</div>")
          .join("");
      }

      function isValidLinkHref(href) {
        return /^https?:\\/\\//i.test(href) || /^mailto:/i.test(href);
      }

      function validateLinksInput(text) {
        const lines = text
          .split("\\n")
          .map((line) => line.trim())
          .filter(Boolean);
        let invalidCount = 0;
        lines.forEach((line) => {
          const parts = line.split("|");
          const href = (parts[1] || "").trim();
          if (!href || !isValidLinkHref(href)) {
            invalidCount += 1;
          }
        });
        return invalidCount;
      }

      function filteredTasks() {
        return state.data.tasks.filter((task) => {
          const q = state.search.trim().toLowerCase();
          const bySearch = !q || task.title.toLowerCase().includes(q) || (task.description || "").toLowerCase().includes(q);
          const byPriority = state.priorityFilter === "all" || task.priority === state.priorityFilter;
          const byOwner = state.ownerFilter === "all" || task.owner === state.ownerFilter;
          return bySearch && byPriority && byOwner;
        });
      }

      function applyDetailsLayout() {
        const layout = document.querySelector(".board-layout");
        if (!layout) {
          return;
        }
        layout.classList.toggle("details-collapsed", !state.detailsOpen);
      }

      function renderBoard() {
        const container = document.getElementById("board-columns");
        const tasks = filteredTasks();
        container.innerHTML = statusOrder.map((status) => {
          const count = tasks.filter((task) => task.status === status).length;
          return '<div class="col" data-status="' + status + '"><h3><span>' + statusLabel[status] + '</span><span>' + count + '</span></h3><div data-slot="' + status + '"></div></div>';
        }).join("");

        statusOrder.forEach((status) => {
          const slot = container.querySelector('[data-slot="' + status + '"]');
          tasks
            .filter((task) => task.status === status)
            .forEach((task) => {
              const node = document.createElement("div");
              node.className = "card";
              node.draggable = true;
              node.dataset.id = task.id;
              node.innerHTML =
                '<div class="card-title">' +
                task.title +
                '</div><span class="pill ' +
                task.priority +
                '">' +
                task.priority +
                '</span><span class="owner-pill ' +
                (task.owner || "builder") +
                '">' +
                (task.owner || "builder") +
                "</span>";
              node.addEventListener("click", () => {
                if (state.selectedTaskId && state.selectedTaskId !== task.id) {
                  flushDetailSave();
                }
                state.detailsOpen = true;
                state.selectedTaskId = task.id;
                state.detailDraft = null;
                state.detailDirty = false;
                state.detailSaving = false;
                renderAll();
              });
              node.addEventListener("dragstart", (event) => {
                event.dataTransfer.setData("text/plain", task.id);
                node.classList.add("dragging");
              });
              node.addEventListener("dragend", () => node.classList.remove("dragging"));
              slot.appendChild(node);
            });
        });

        container.querySelectorAll(".col").forEach((col) => {
          col.addEventListener("dragover", (event) => {
            event.preventDefault();
            col.classList.add("drag-over");
          });
          col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
          col.addEventListener("drop", (event) => {
            event.preventDefault();
            col.classList.remove("drag-over");
            const id = event.dataTransfer.getData("text/plain");
            const status = col.dataset.status;
            if (id && status) {
              vscode.postMessage({ type: "moveTask", id, status });
            }
          });
        });
      }

      function selectedTask() {
        return state.data.tasks.find((task) => task.id === state.selectedTaskId) || null;
      }

      function getDetailStateLabel() {
        if (state.detailSaving) return { text: "Saving...", cls: "detail-state saving" };
        if (state.detailDirty) return { text: "Unsaved", cls: "detail-state unsaved" };
        return { text: "Saved", cls: "detail-state" };
      }

      function renderDetailStateIndicator() {
        const label = getDetailStateLabel();
        const el = document.getElementById("detail-save-state");
        if (!el) {
          return;
        }
        el.textContent = label.text;
        el.className = label.cls;
      }

      function linksToText(links) {
        return (links || []).map((link) => link.label + "|" + link.href).join("\\n");
      }

      function parseLinks(text) {
        return text
          .split("\\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [label, href] = line.split("|");
            return {
              label: (label || "Link").trim(),
              href: (href || "").trim()
            };
          })
          .filter((link) => link.href.length > 0);
      }

      function currentDetailPayload(task) {
        const draft = state.detailDraft && state.detailDraft.taskId === task.id ? state.detailDraft : null;
        return {
          title: draft ? draft.title : task.title,
          priority: draft ? draft.priority : task.priority,
          owner: draft ? draft.owner : (task.owner || "builder"),
          description: draft ? draft.description : (task.description || ""),
          linksText: draft ? draft.linksText : linksToText(task.links || []),
          linksInvalid: draft ? draft.linksInvalid : 0
        };
      }

      function saveTaskDetails() {
        const task = selectedTask();
        if (!task || !state.detailDirty || !state.detailDraft || state.detailDraft.taskId !== task.id) {
          return;
        }
        state.detailSaving = true;
        renderDetailStateIndicator();
        vscode.postMessage({
          type: "updateTask",
          taskId: task.id,
          patch: {
            title: state.detailDraft.title,
            priority: state.detailDraft.priority,
            owner: state.detailDraft.owner,
            description: state.detailDraft.description,
            links: parseLinks(state.detailDraft.linksText)
          }
        });
      }

      function scheduleDetailSave() {
        if (state.detailSaveTimer) {
          clearTimeout(state.detailSaveTimer);
        }
        state.detailSaveTimer = setTimeout(() => {
          state.detailSaveTimer = null;
          saveTaskDetails();
        }, DETAIL_SAVE_DEBOUNCE_MS);
      }

      function flushDetailSave() {
        if (state.detailSaveTimer) {
          clearTimeout(state.detailSaveTimer);
          state.detailSaveTimer = null;
        }
        saveTaskDetails();
      }

      function renderDetails() {
        const host = document.getElementById("task-details");
        const task = selectedTask();
        if (!task) {
          state.detailDraft = null;
          state.detailDirty = false;
          state.detailSaving = false;
          host.innerHTML = '<div class="empty">Select a task card to view details.</div>';
          return;
        }

        const detail = currentDetailPayload(task);
        const detailState = getDetailStateLabel();
        const taskActivity = state.data.activity.filter((item) => item.taskId === task.id).slice(0, 6);
        host.innerHTML =
          '<div class="details-head"><h2>' + task.title + '</h2><span id="detail-save-state" class="' + detailState.cls + '">' + detailState.text + '</span><button class="close-details-btn" id="close-details-btn" title="Скрыть панель деталей задачи">×</button></div>' +
          '<div class="meta"><span class="pill ' + task.priority + '">' + task.priority + '</span><span class="owner-pill ' + (task.owner || "builder") + '">' + (task.owner || "builder") + '</span><span class="muted">' + statusLabel[task.status] + '</span></div>' +
          '<div class="details-section detail-grid">' +
          '<div class="title-field"><label>Title</label><input id="detail-title" maxlength="120" value="' + detail.title.replace(/"/g, "&quot;") + '" /></div>' +
          '<div><label>Priority</label><select id="detail-priority"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select></div>' +
          '<div><label>Owner</label><select id="detail-owner"><option value="planner">planner</option><option value="builder">builder</option><option value="qa">qa</option><option value="scribe">scribe</option></select></div>' +
          '</div>' +
          '<div class="details-section"><label>Description (Markdown)</label><textarea id="detail-description">' + detail.description + '</textarea></div>' +
          '<div class="preview">' + markdownToHtml(detail.description) + '</div>' +
          '<div class="details-section"><label>Links (one per line: label|https://...)</label><textarea id="detail-links">' +
          detail.linksText +
          '</textarea>' +
          (detail.linksInvalid > 0 ? '<div class="details-error">' + detail.linksInvalid + ' link(s) will be ignored (invalid URL).</div>' : "") +
          '</div>' +
          '<div class="link-list">' + (task.links || []).map((link) => '<div><a href="' + link.href + '" target="_blank" rel="noreferrer">' + link.label + '</a></div>').join("") + '</div>' +
          '<div class="details-section"><label>Checklist</label><div id="checklist"></div><div class="check-create"><input id="new-check-item" placeholder="Add checklist item..." /><button class="btn" id="add-check-btn" title="Добавить пункт в чеклист">Add</button></div></div>' +
          '<div class="detail-actions"><button class="btn danger" id="delete-task-btn" title="Удалить задачу с доски">Delete</button><button class="btn" id="start-task-btn" title="Перевести задачу в In Progress">Start</button><button class="btn" id="complete-task-btn" title="Отметить задачу как выполненную">Complete</button></div>' +
          '<div class="mini-activity"><strong>Mini activity</strong><div>' +
          (taskActivity.length
            ? taskActivity.map((item) => '<div class="act-item">' + formatTs(item.ts) + " - " + item.message + "</div>").join("")
            : '<div class="muted">No events yet.</div>') +
          "</div></div>";

        const priority = host.querySelector("#detail-priority");
        priority.value = detail.priority;
        const owner = host.querySelector("#detail-owner");
        owner.value = detail.owner;

        const checklistHost = host.querySelector("#checklist");
        (task.checklist || []).forEach((item) => {
          const row = document.createElement("label");
          row.className = "check-item";
          row.innerHTML = '<input type="checkbox" ' + (item.done ? "checked" : "") + ' /> <span>' + item.text + '</span><button class="check-delete" title="Удалить пункт чеклиста" data-check-id="' + item.id + '">x</button>';
          row.querySelector("input").addEventListener("change", (event) => {
            vscode.postMessage({ type: "toggleChecklist", taskId: task.id, checklistId: item.id, done: event.target.checked });
          });
          row.querySelector(".check-delete").addEventListener("click", (event) => {
            event.preventDefault();
            vscode.postMessage({ type: "removeChecklistItem", taskId: task.id, checklistId: item.id });
          });
          checklistHost.appendChild(row);
        });
        function addChecklistItem() {
          const input = host.querySelector("#new-check-item");
          const text = input.value.trim();
          if (!text) return;
          vscode.postMessage({ type: "addChecklistItem", taskId: task.id, text });
          input.value = "";
        }
        host.querySelector("#add-check-btn").addEventListener("click", addChecklistItem);
        host.querySelector("#new-check-item").addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addChecklistItem();
          }
        });

        function onDetailChanged() {
          const linksText = host.querySelector("#detail-links").value;
          const linksInvalid = validateLinksInput(linksText);
          state.detailDraft = {
            taskId: task.id,
            title: host.querySelector("#detail-title").value,
            priority: host.querySelector("#detail-priority").value,
            owner: host.querySelector("#detail-owner").value,
            description: host.querySelector("#detail-description").value,
            linksText,
            linksInvalid
          };
          state.detailDirty = true;
          state.detailSaving = false;
          renderDetailStateIndicator();
          scheduleDetailSave();
        }

        host.querySelector("#detail-title").addEventListener("input", onDetailChanged);
        host.querySelector("#detail-priority").addEventListener("change", onDetailChanged);
        host.querySelector("#detail-owner").addEventListener("change", onDetailChanged);
        host.querySelector("#detail-description").addEventListener("input", onDetailChanged);
        host.querySelector("#detail-links").addEventListener("input", onDetailChanged);
        host.querySelector("#close-details-btn").addEventListener("click", () => {
          flushDetailSave();
          state.detailsOpen = false;
          state.selectedTaskId = null;
          state.detailDraft = null;
          state.detailDirty = false;
          state.detailSaving = false;
          renderAll();
        });

        host.querySelector("#delete-task-btn").addEventListener("click", () => {
          state.detailDirty = false;
          state.detailSaving = false;
          state.detailDraft = null;
          vscode.postMessage({ type: "deleteTask", taskId: task.id });
        });
        host.querySelector("#start-task-btn").addEventListener("click", () => vscode.postMessage({ type: "moveTask", id: task.id, status: "inprogress" }));
        host.querySelector("#complete-task-btn").addEventListener("click", () => vscode.postMessage({ type: "moveTask", id: task.id, status: "done" }));
      }

      function renderDocs() {
        document.getElementById("doc-title").textContent = state.selectedDoc === "__main__" ? "Main Document" : state.selectedDoc;
        document.getElementById("doc-editor").value = state.docDraft;
        document.getElementById("doc-preview").innerHTML = markdownToHtml(state.docDraft);
        renderDocState();

        const docsHost = document.getElementById("extra-docs");
        docsHost.innerHTML = "";
        state.docs.forEach((name) => {
          const btn = document.createElement("button");
          btn.className = "btn";
          btn.textContent = name;
          btn.title = "Открыть документ " + name;
          btn.addEventListener("click", () => {
            flushDocSave();
            state.selectedDoc = name;
            vscode.postMessage({ type: "readDoc", name });
          });
          docsHost.appendChild(btn);
        });
      }

      function renderDocState() {
        const el = document.getElementById("doc-save-state");
        if (state.docSaving) {
          el.textContent = "Saving...";
          el.className = "doc-state saving";
          return;
        }
        if (state.docDirty) {
          el.textContent = "Unsaved";
          el.className = "doc-state unsaved";
          return;
        }
        el.textContent = "Saved";
        el.className = "doc-state";
      }

      function saveCurrentDoc() {
        if (!state.docDirty) {
          return;
        }
        state.docSaving = true;
        renderDocState();
        if (state.selectedDoc === "__main__") {
          vscode.postMessage({ type: "saveMainDoc", content: state.docDraft });
        } else {
          vscode.postMessage({ type: "saveDoc", name: state.selectedDoc, content: state.docDraft });
        }
      }

      function scheduleDocSave() {
        if (state.docSaveTimer) {
          clearTimeout(state.docSaveTimer);
        }
        state.docSaveTimer = setTimeout(() => {
          state.docSaveTimer = null;
          saveCurrentDoc();
        }, DOC_SAVE_DEBOUNCE_MS);
      }

      function flushDocSave() {
        if (state.docSaveTimer) {
          clearTimeout(state.docSaveTimer);
          state.docSaveTimer = null;
        }
        saveCurrentDoc();
      }

      function renderActivity() {
        const host = document.getElementById("activity-list");
        const filtered = state.data.activity.filter((item) => {
          if (state.activityFilter === "all") {
            return true;
          }
          if (state.activityFilter === "tasks") {
            return item.type.startsWith("task_") || item.type.startsWith("checklist_");
          }
          if (state.activityFilter === "docs") {
            return item.type === "doc_saved";
          }
          if (state.activityFilter === "agent") {
            return item.type === "ingest" || item.type === "outbox_sync";
          }
          return true;
        });
        if (!filtered.length) {
          host.innerHTML = '<div class="empty">No activity yet.</div>';
          return;
        }
        host.innerHTML = filtered
          .map((item) => '<div class="activity-card"><div><strong>' + item.type + '</strong></div><div>' + item.message + '</div><div class="muted">' + formatTs(item.ts) + "</div></div>")
          .join("");
      }

      function renderAll() {
        applyDetailsLayout();
        renderBoard();
        renderDetails();
        renderDocs();
        renderActivity();
      }

      document.querySelectorAll(".tab").forEach((tabBtn) => {
        tabBtn.addEventListener("click", () => {
          const tab = tabBtn.dataset.tab;
          if (tab !== "docs") {
            flushDocSave();
          }
          if (tab !== "board") {
            flushDetailSave();
          }
          document.querySelectorAll(".tab").forEach((btn) => btn.classList.remove("active"));
          document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
          tabBtn.classList.add("active");
          document.getElementById(tab + "-view").classList.add("active");
        });
      });

      document.getElementById("search-input").addEventListener("input", (event) => {
        state.search = event.target.value;
        renderBoard();
      });

      document.getElementById("priority-filter").addEventListener("change", (event) => {
        state.priorityFilter = event.target.value;
        renderBoard();
      });
      document.getElementById("owner-filter").addEventListener("change", (event) => {
        state.ownerFilter = event.target.value;
        renderBoard();
      });

      document.getElementById("activity-filter").addEventListener("change", (event) => {
        state.activityFilter = event.target.value;
        renderActivity();
      });

      function createTaskFromInput() {
        const input = document.getElementById("new-task-title");
        const title = (input.value || "").trim();
        if (!title) return;
        vscode.postMessage({ type: "createTask", title });
        input.value = "";
      }

      document.getElementById("new-task-btn").addEventListener("click", createTaskFromInput);
      document.getElementById("run-cycle-btn").addEventListener("click", () => {
        vscode.postMessage({ type: "runCycle" });
      });
      document.getElementById("new-task-title").addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          createTaskFromInput();
        }
      });

      document.getElementById("create-doc-btn").addEventListener("click", () => {
        const input = document.getElementById("new-doc-name");
        const name = input.value.trim();
        if (!name) return;
        flushDocSave();
        state.selectedDoc = name;
        state.docDraft = "# " + name + "\\n\\n";
        state.docDirty = true;
        state.docSaving = false;
        renderDocs();
        vscode.postMessage({ type: "saveDoc", name, content: "# " + name + "\\n\\n" });
        input.value = "";
      });

      document.querySelector('[data-doc="__main__"]').addEventListener("click", () => {
        flushDocSave();
        state.selectedDoc = "__main__";
        state.docDraft = state.data.docMarkdown || "";
        state.docDirty = false;
        state.docSaving = false;
        renderDocs();
      });

      document.getElementById("doc-editor").addEventListener("input", (event) => {
        state.docDraft = event.target.value;
        state.docDirty = true;
        state.docSaving = false;
        document.getElementById("doc-preview").innerHTML = markdownToHtml(state.docDraft);
        renderDocState();
        scheduleDocSave();
      });

      window.addEventListener("message", (event) => {
        const message = event.data || {};
        if (message.type === "init") {
          state.data = message.data;
          state.docs = message.docs || [];
          state.selectedDoc = "__main__";
          state.docDraft = state.data.docMarkdown || "";
          state.docDirty = false;
          state.docSaving = false;
          state.detailDraft = null;
          state.detailDirty = false;
          state.detailSaving = false;
          if (!state.selectedTaskId && state.data.tasks[0]) {
            state.selectedTaskId = state.data.tasks[0].id;
          }
          renderAll();
        } else if (message.type === "state") {
          state.data = message.data;
          if (state.selectedDoc === "__main__" && (!state.docDirty || state.docSaving)) {
            state.docDraft = state.data.docMarkdown || "";
            state.docDirty = false;
            state.docSaving = false;
          }
          const selected = selectedTask();
          if (!selected) {
            state.selectedTaskId = state.data.tasks[0] ? state.data.tasks[0].id : null;
            state.detailDraft = null;
            state.detailDirty = false;
            state.detailSaving = false;
          } else if (state.detailSaving) {
            state.detailSaving = false;
            state.detailDirty = false;
            state.detailDraft = null;
          }
          renderAll();
        } else if (message.type === "docContent") {
          state.selectedDoc = message.name;
          state.docDraft = message.content || "";
          state.docDirty = false;
          state.docSaving = false;
          renderDocs();
        } else if (message.type === "docsList") {
          state.docs = message.docs || [];
          renderDocs();
        } else if (message.type === "notice" && message.notice) {
          showToast(message.notice.kind || "info", message.notice.message || "Action processed.");
        }
      });

      vscode.postMessage({ type: "ready" });
    </script>
  </body>
</html>`;
}

export function safeHtmlText(value: string): string {
  return escapeHtml(value);
}
