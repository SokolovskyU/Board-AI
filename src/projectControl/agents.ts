import * as vscode from "vscode";
import { TextEncoder } from "util";
import { decodeTextBytes } from "./encoding";
import { upsertAgentsRules } from "./agentsRules";

const encoder = new TextEncoder();
const AGENTS_FILE = "AGENTS.md";

export async function ensureAgentsRules(workspaceRoot: vscode.Uri): Promise<void> {
  const fileUri = vscode.Uri.joinPath(workspaceRoot, AGENTS_FILE);
  let existing = "";
  try {
    const bytes = await vscode.workspace.fs.readFile(fileUri);
    existing = decodeTextBytes(bytes);
  } catch {
    existing = "";
  }

  const next = upsertAgentsRules(existing);
  if (next === existing) {
    return;
  }
  await vscode.workspace.fs.writeFile(fileUri, encoder.encode(next));
}
