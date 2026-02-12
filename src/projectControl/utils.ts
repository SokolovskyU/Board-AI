function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makeEntityId(prefix: string): string {
  return makeId(prefix);
}

export function sanitizeDocName(name: string): string {
  const normalized = name.trim().replace(/[\\/:*?"<>|]/g, "-");
  if (!normalized) {
    return "notes.md";
  }
  return normalized.toLowerCase().endsWith(".md") ? normalized : `${normalized}.md`;
}
