/**
 * Agent response templates — predefined message templates that agents
 * can use for common responses (greetings, errors, status updates).
 *
 * Supports variable interpolation with {{variable}} syntax.
 */

export interface AgentTemplate {
  id: string;
  agentName: string;
  name: string;
  content: string;
  category: string; // e.g. "greeting", "error", "status", "general"
  createdAt: string;
}

const store = new Map<string, AgentTemplate>();

/** Create a new template for an agent. */
export function createTemplate(
  agentName: string,
  name: string,
  content: string,
  category: string = "general",
): AgentTemplate {
  const template: AgentTemplate = {
    id: crypto.randomUUID(),
    agentName,
    name,
    content,
    category,
    createdAt: new Date().toISOString(),
  };
  store.set(template.id, template);
  return template;
}

/** List templates for an agent, optionally filtered by category. */
export function listTemplates(agentName: string, category?: string): AgentTemplate[] {
  const result: AgentTemplate[] = [];
  for (const t of store.values()) {
    if (t.agentName === agentName && (!category || t.category === category)) {
      result.push(t);
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

/** Get a template by ID. */
export function getTemplate(templateId: string): AgentTemplate | null {
  return store.get(templateId) ?? null;
}

/** Delete a template. */
export function deleteTemplate(templateId: string): boolean {
  return store.delete(templateId);
}

/** Render a template with variable substitution. */
export function renderTemplate(
  content: string,
  variables: Record<string, string>,
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}

/** Extract variable names from a template string. */
export function extractVariables(content: string): string[] {
  const vars = new Set<string>();
  const regex = /\{\{(\w+)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    vars.add(match[1]);
  }
  return [...vars];
}

/** List all unique categories used by an agent. */
export function listCategories(agentName: string): string[] {
  const cats = new Set<string>();
  for (const t of store.values()) {
    if (t.agentName === agentName) cats.add(t.category);
  }
  return [...cats].sort();
}

/** Clear all templates (for testing). */
export function clearAll(): void {
  store.clear();
}
