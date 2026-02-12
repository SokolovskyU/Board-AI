const BLOCK_START = "<!-- project-control:start -->";
const BLOCK_END = "<!-- project-control:end -->";

const RULES_BODY = `# Codex Project Rules

Всегда работай через Project Control.

Правила:
- Режим работы строго по фазам:
  1) Сначала сформируй/обнови полный список задач в \`todo\` (план работ).
  2) Затем выполняй задачи поочередно: берешь одну из \`todo\` -> переводишь в \`inprogress\` -> после реализации и проверки в \`done\`.
- Одновременно в \`inprogress\` держи только одну задачу, если пользователь явно не запросил параллельное выполнение.
- Перед началом работы создай/обнови задачи в \`.project-control/data.json\` через команды/контракт расширения.
- Новые задачи ставь в \`todo\`.
- Когда начинаешь выполнять задачу, переводи в \`inprogress\`.
- После реализации и проверки переводи в \`done\`.
- Поддерживай \`description\` и \`checklist\` на русском языке.
- Пиши activity по ключевым шагам так, чтобы в реальном времени было видно:
  - что собираешься делать (plan / todo),
  - что делаешь сейчас (inprogress),
  - что уже готово (done).
- Если пользователь дал новый большой промпт, используй \`Project Control: Ingest Prompt\`.
- Если есть структурированный \`agent_outbox.md\`, используй \`Project Control: Sync From Outbox\`.
- Не игнорируй Project Control: доска должна отражать фактический прогресс.
`;

export const RULES_BLOCK = `${BLOCK_START}
${RULES_BODY}
${BLOCK_END}
`;

function hasEquivalentRules(content: string): boolean {
  return (
    content.includes("Режим работы строго по фазам:") &&
    content.includes("Всегда работай через Project Control.") &&
    content.includes(".project-control/data.json") &&
    content.includes("Project Control: Ingest Prompt") &&
    content.includes("Project Control: Sync From Outbox")
  );
}

function isLegacyPlainRules(content: string): boolean {
  return (
    content.includes("# Codex Project Rules") &&
    content.includes("Всегда работай через Project Control.") &&
    !content.includes(BLOCK_START)
  );
}

export function upsertAgentsRules(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n");
  const startIndex = normalized.indexOf(BLOCK_START);
  const endIndex = normalized.indexOf(BLOCK_END);
  if (startIndex >= 0 && endIndex > startIndex) {
    const before = normalized.slice(0, startIndex).trimEnd();
    const after = normalized.slice(endIndex + BLOCK_END.length).trimStart();
    const pieces = [before, RULES_BLOCK.trimEnd(), after].filter(Boolean);
    return `${pieces.join("\n\n")}\n`;
  }

  if (hasEquivalentRules(normalized)) {
    return normalized.endsWith("\n") ? normalized : `${normalized}\n`;
  }

  if (isLegacyPlainRules(normalized)) {
    return RULES_BLOCK;
  }

  if (!normalized.trim()) {
    return RULES_BLOCK;
  }

  return `${normalized.trimEnd()}\n\n${RULES_BLOCK}`;
}
