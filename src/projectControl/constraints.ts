import { ChecklistItem, TaskLink } from "./types";

export const MAX_TITLE_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 8000;
export const MAX_DOC_LENGTH = 200000;
export const MAX_CHECKLIST_ITEM_LENGTH = 200;
export const MAX_LINK_LABEL_LENGTH = 80;
export const MAX_LINKS_PER_TASK = 20;
export const MAX_CHECKLIST_ITEMS_PER_TASK = 50;

export function clampText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function sanitizeTitle(value: unknown): string {
  if (typeof value !== "string") {
    return "Untitled task";
  }
  const title = clampText(value, MAX_TITLE_LENGTH);
  return title || "Untitled task";
}

export function sanitizeDescription(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.slice(0, MAX_DESCRIPTION_LENGTH);
}

export function sanitizeDocContent(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.slice(0, MAX_DOC_LENGTH);
}

export function sanitizeChecklistText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return clampText(value, MAX_CHECKLIST_ITEM_LENGTH);
}

export function isValidLinkHref(value: string): boolean {
  if (!value) {
    return false;
  }
  if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value)) {
    return true;
  }
  return false;
}

export function sanitizeLinks(value: unknown): TaskLink[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const result: TaskLink[] = [];
  for (const rawLink of value) {
    if (!rawLink || typeof rawLink !== "object") {
      continue;
    }
    const typed = rawLink as { label?: unknown; href?: unknown };
    const href = typeof typed.href === "string" ? typed.href.trim() : "";
    if (!isValidLinkHref(href)) {
      continue;
    }
    const dedupeKey = href.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    result.push({
      label:
        typeof typed.label === "string" && typed.label.trim()
          ? clampText(typed.label, MAX_LINK_LABEL_LENGTH)
          : "Link",
      href
    });
    if (result.length >= MAX_LINKS_PER_TASK) {
      break;
    }
  }
  return result;
}

export function sanitizeChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const result: ChecklistItem[] = [];
  for (const rawItem of value) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }
    const typed = rawItem as { id?: unknown; text?: unknown; done?: unknown };
    const text = sanitizeChecklistText(typed.text);
    if (!text) {
      continue;
    }
    const dedupeKey = text.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    result.push({
      id: typeof typed.id === "string" && typed.id ? typed.id : "",
      text,
      done: Boolean(typed.done)
    });
    if (result.length >= MAX_CHECKLIST_ITEMS_PER_TASK) {
      break;
    }
  }
  return result;
}
