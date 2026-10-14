import { DEPARTMENT_IDS, type DepartmentId } from './departments.js';
import { AgentInputSchema, type AgentInput } from './schemas.js';

export interface ImportResult {
  ok: boolean;
  agent?: AgentInput;
  errors: string[];
}

const MODEL_ALIASES: Record<string, string | undefined> = {
  inherit: undefined,
  opus: 'claude-opus-5-5',
  sonnet: 'claude-sonnet-5-5',
  haiku: 'claude-haiku-5-5',
};

function slug(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'agente'
  );
}

function parseFrontmatter(text: string): { meta: Record<string, string>; body: string } | null {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return null;
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (kv) meta[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body: m[2].trim() };
}

/**
 * Import an agent definition the user created elsewhere:
 *  - a Claude Code subagent file (`~/.claude/agents/<name>.md`: YAML
 *    frontmatter `name`, `description`, `tools`, `model` + the prompt body), or
 *  - a JSON export of a PIXEL AGENCY agent.
 * The department is taken from the argument (the user chooses it in the app).
 */
export function importAgentDefinition(
  text: string,
  opts: { department?: DepartmentId; palette?: number } = {},
): ImportResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, errors: ['Arquivo vazio.'] };

  let candidate: Record<string, unknown>;
  if (trimmed.startsWith('{')) {
    try {
      candidate = JSON.parse(trimmed) as Record<string, unknown>;
    } catch (e) {
      return { ok: false, errors: [`JSON inválido: ${(e as Error).message}`] };
    }
  } else {
    const fm = parseFrontmatter(trimmed);
    if (!fm) {
      return {
        ok: false,
        errors: ['Formato não reconhecido: esperado JSON ou Markdown com frontmatter (---).'],
      };
    }
    const name = fm.meta.name || 'Agente';
    const tools = (fm.meta.tools ?? '')
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    candidate = {
      id: slug(name),
      name: name.charAt(0).toUpperCase() + name.slice(1),
      role: fm.meta.role ?? fm.meta.description?.slice(0, 120) ?? '',
      description: fm.meta.description ?? '',
      instructions: fm.body,
      tools,
      model: fm.meta.model ? (MODEL_ALIASES[fm.meta.model] ?? fm.meta.model) : undefined,
    };
  }

  const department =
    opts.department ??
    (DEPARTMENT_IDS.includes(candidate.department as DepartmentId)
      ? (candidate.department as DepartmentId)
      : 'desenvolvimento');
  const parsed = AgentInputSchema.safeParse({
    ...candidate,
    id: typeof candidate.id === 'string' ? slug(candidate.id) : undefined,
    department,
    palette: opts.palette ?? candidate.palette ?? 0,
    source: 'imported',
    sourceNote: undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'agente'}: ${i.message}`),
    };
  }
  return { ok: true, agent: parsed.data, errors: [] };
}

export { slug as slugify };
