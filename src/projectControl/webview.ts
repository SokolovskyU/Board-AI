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
        --bg: #0e1118;
        --panel: #141a26;
        --panel-2: #101624;
        --muted: #8ea0bb;
        --text: #dce6f4;
        --line: #253149;
        --accent: #3ea6ff;
        --danger: #ff6b6b;
        --low: #6cc070;
        --medium: #f0b14b;
        --high: #ff7d7d;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", Tahoma, sans-serif;
        background: radial-gradient(circle at top right, #16243f 0%, var(--bg) 45%);
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
        background: rgba(10, 16, 27, 0.7);
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
        background: #162039;
      }
      .view { display: none; height: calc(100vh - 54px); overflow: hidden; }
      .view.active { display: block; }
      .board-layout {
        height: 100%;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 340px;
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
        background: #1b2740;
        border: 1px solid var(--line);
        color: var(--text);
        border-radius: 8px;
        padding: 8px 10px;
        cursor: pointer;
      }
      .btn:hover { border-color: #3a4b6d; }
      .btn.danger { color: #ffd2d2; border-color: #6f2d2d; background: #351d22; }
      .columns {
        display: grid;
        grid-template-columns: repeat(4, minmax(220px, 1fr));
        gap: 10px;
      }
      .col {
        background: rgba(18, 25, 38, 0.9);
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
        border: 1px solid #293754;
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
      .details {
        border-left: 1px solid var(--line);
        background: rgba(11, 16, 27, 0.85);
        padding: 14px;
        overflow: auto;
      }
      .details h2 { margin: 0 0 8px; }
      .meta { display: flex; gap: 8px; margin: 8px 0 10px; align-items: center; }
      .details-section { margin-top: 10px; }
      .details-section label {
        display: block;
        margin-bottom: 6px;
        font-size: 12px;
        color: var(--muted);
      }
      .detail-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 110px;
        gap: 8px;
        align-items: end;
      }
      .detail-actions {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }
      .mini-activity { margin-top: 10px; border-top: 1px solid var(--line); padding-top: 10px; }
      .act-item { font-size: 12px; color: #bfd0ea; padding: 6px 0; border-bottom: 1px solid #1f2a42; }
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
      .activity-card {
        background: rgba(18, 25, 38, 0.9);
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 12px;
        margin-bottom: 10px;
      }
      .link-list a { color: #8ac8ff; }
      .check-item { display: flex; gap: 8px; align-items: center; margin: 6px 0; }
      .check-item span { flex: 1; }
      .check-delete {
        border: 1px solid #6f2d2d;
        background: #351d22;
        color: #ffd2d2;
        border-radius: 6px;
        padding: 2px 8px;
        cursor: pointer;
      }
      .check-create { display: grid; grid-template-columns: 1fr auto; gap: 8px; margin-top: 8px; }
      .doc-state { font-size: 12px; color: var(--muted); margin-left: auto; }
      .doc-state.unsaved { color: var(--medium); }
      .doc-state.saving { color: var(--accent); }
      .muted { color: var(--muted); }
      .row { display: flex; gap: 8px; }
    </style>
  </head>
  <body>
    <div class="app">
      <div class="tabs">
        <button class="tab active" data-tab="board">Board</button>
        <button class="tab" data-tab="docs">Docs</button>
        <button class="tab" data-tab="activity">Activity</button>
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
              <input id="new-task-title" placeholder="New task title..." />
              <button class="btn" id="new-task-btn">New Task</button>
            </div>
            <div class="columns" id="board-columns"></div>
          </div>
          <aside class="details" id="task-details"></aside>
        </div>
      </section>

      <section id="docs-view" class="view">
        <div class="docs-layout">
          <aside class="doc-list">
            <button class="btn" data-doc="__main__">Main Document</button>
            <div id="extra-docs"></div>
            <div class="row">
              <input id="new-doc-name" placeholder="new-doc.md" />
              <button class="btn" id="create-doc-btn">+</button>
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
        <div id="activity-list"></div>
      </section>
    </div>

    <script nonce="${scriptNonce}">
      const vscode = acquireVsCodeApi();
      const state = {
        data: { version: 1, tasks: [], docMarkdown: "", activity: [] },
        selectedTaskId: null,
        search: "",
        priorityFilter: "all",
        docs: [],
        selectedDoc: "__main__",
        docDraft: "",
        docDirty: false,
        docSaving: false,
        docSaveTimer: null
      };
      const DOC_SAVE_DEBOUNCE_MS = 600;

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

      function filteredTasks() {
        return state.data.tasks.filter((task) => {
          const q = state.search.trim().toLowerCase();
          const bySearch = !q || task.title.toLowerCase().includes(q) || (task.description || "").toLowerCase().includes(q);
          const byPriority = state.priorityFilter === "all" || task.priority === state.priorityFilter;
          return bySearch && byPriority;
        });
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
              node.innerHTML = '<div class="card-title">' + task.title + '</div><span class="pill ' + task.priority + '">' + task.priority + '</span>';
              node.addEventListener("click", () => {
                state.selectedTaskId = task.id;
                renderDetails();
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

      function renderDetails() {
        const host = document.getElementById("task-details");
        const task = selectedTask();
        if (!task) {
          host.innerHTML = '<div class="empty">Select a task card to view details.</div>';
          return;
        }

        const taskActivity = state.data.activity.filter((item) => item.taskId === task.id).slice(0, 6);
        host.innerHTML =
          '<h2>' + task.title + '</h2>' +
          '<div class="meta"><span class="pill ' + task.priority + '">' + task.priority + '</span><span class="muted">' + statusLabel[task.status] + '</span></div>' +
          '<div class="details-section detail-grid">' +
          '<div><label>Title</label><input id="detail-title" value="' + task.title.replace(/"/g, "&quot;") + '" /></div>' +
          '<div><label>Priority</label><select id="detail-priority"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select></div>' +
          '</div>' +
          '<div class="details-section"><label>Description (Markdown)</label><textarea id="detail-description">' + (task.description || "") + '</textarea></div>' +
          '<div class="preview">' + markdownToHtml(task.description || "") + '</div>' +
          '<div class="details-section"><label>Links (one per line: label|https://...)</label><textarea id="detail-links">' +
          (task.links || []).map((link) => link.label + "|" + link.href).join("\\n") +
          '</textarea></div>' +
          '<div class="link-list">' + (task.links || []).map((link) => '<div><a href="' + link.href + '" target="_blank" rel="noreferrer">' + link.label + '</a></div>').join("") + '</div>' +
          '<div class="details-section"><label>Checklist</label><div id="checklist"></div><div class="check-create"><input id="new-check-item" placeholder="Add checklist item..." /><button class="btn" id="add-check-btn">Add</button></div></div>' +
          '<div class="detail-actions"><button class="btn" id="edit-task-btn">Edit</button><button class="btn danger" id="delete-task-btn">Delete</button><button class="btn" id="start-task-btn">Start</button><button class="btn" id="complete-task-btn">Complete</button></div>' +
          '<div class="mini-activity"><strong>Mini activity</strong><div>' +
          (taskActivity.length
            ? taskActivity.map((item) => '<div class="act-item">' + formatTs(item.ts) + " - " + item.message + "</div>").join("")
            : '<div class="muted">No events yet.</div>') +
          "</div></div>";

        const priority = host.querySelector("#detail-priority");
        priority.value = task.priority;

        const checklistHost = host.querySelector("#checklist");
        (task.checklist || []).forEach((item) => {
          const row = document.createElement("label");
          row.className = "check-item";
          row.innerHTML = '<input type="checkbox" ' + (item.done ? "checked" : "") + ' /> <span>' + item.text + '</span><button class="check-delete" data-check-id="' + item.id + '">x</button>';
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

        host.querySelector("#edit-task-btn").addEventListener("click", () => {
          const title = host.querySelector("#detail-title").value.trim();
          const nextPriority = host.querySelector("#detail-priority").value;
          const description = host.querySelector("#detail-description").value;
          const links = host
            .querySelector("#detail-links")
            .value.split("\\n")
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
          vscode.postMessage({ type: "updateTask", taskId: task.id, patch: { title, priority: nextPriority, description, links } });
        });
        host.querySelector("#delete-task-btn").addEventListener("click", () => vscode.postMessage({ type: "deleteTask", taskId: task.id }));
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
        if (!state.data.activity.length) {
          host.innerHTML = '<div class="empty">No activity yet.</div>';
          return;
        }
        host.innerHTML = state.data.activity
          .map((item) => '<div class="activity-card"><div><strong>' + item.type + '</strong></div><div>' + item.message + '</div><div class="muted">' + formatTs(item.ts) + "</div></div>")
          .join("");
      }

      function renderAll() {
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

      function createTaskFromInput() {
        const input = document.getElementById("new-task-title");
        const title = (input.value || "").trim();
        if (!title) return;
        vscode.postMessage({ type: "createTask", title });
        input.value = "";
      }

      document.getElementById("new-task-btn").addEventListener("click", createTaskFromInput);
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
