/**
 * Tests for agent response templates.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import {
  createTemplate,
  listTemplates,
  getTemplate,
  deleteTemplate,
  renderTemplate,
  extractVariables,
  listCategories,
  clearAll,
} from "../src/services/agent-templates";

beforeEach(() => clearAll());

describe("createTemplate / getTemplate", () => {
  it("creates and retrieves a template", () => {
    const t = createTemplate("bot-1", "greeting", "Hello {{name}}!", "greeting");
    expect(t.agentName).toBe("bot-1");
    expect(t.name).toBe("greeting");
    expect(getTemplate(t.id)).not.toBeNull();
  });
});

describe("listTemplates", () => {
  it("lists templates for an agent", () => {
    createTemplate("bot-1", "hi", "Hello!", "greeting");
    createTemplate("bot-1", "bye", "Goodbye!", "greeting");
    createTemplate("bot-2", "hi", "Hey!", "greeting");
    expect(listTemplates("bot-1").length).toBe(2);
  });

  it("filters by category", () => {
    createTemplate("bot-1", "hi", "Hello!", "greeting");
    createTemplate("bot-1", "err", "Error occurred", "error");
    expect(listTemplates("bot-1", "error").length).toBe(1);
  });
});

describe("deleteTemplate", () => {
  it("deletes a template", () => {
    const t = createTemplate("bot-1", "hi", "Hello!");
    expect(deleteTemplate(t.id)).toBe(true);
    expect(getTemplate(t.id)).toBeNull();
  });

  it("returns false for non-existent", () => {
    expect(deleteTemplate("nope")).toBe(false);
  });
});

describe("renderTemplate", () => {
  it("substitutes variables", () => {
    const result = renderTemplate("Hello {{name}}, welcome to {{channel}}!", {
      name: "Alice",
      channel: "#general",
    });
    expect(result).toBe("Hello Alice, welcome to #general!");
  });

  it("leaves unknown variables intact", () => {
    const result = renderTemplate("Hi {{name}}, {{unknown}}!", { name: "Bob" });
    expect(result).toBe("Hi Bob, {{unknown}}!");
  });

  it("handles template with no variables", () => {
    expect(renderTemplate("No vars here", {})).toBe("No vars here");
  });
});

describe("extractVariables", () => {
  it("extracts variable names", () => {
    const vars = extractVariables("{{greeting}} {{name}}, welcome to {{channel}}");
    expect(vars).toContain("greeting");
    expect(vars).toContain("name");
    expect(vars).toContain("channel");
    expect(vars.length).toBe(3);
  });

  it("deduplicates variables", () => {
    const vars = extractVariables("{{name}} and {{name}} again");
    expect(vars.length).toBe(1);
  });
});

describe("listCategories", () => {
  it("lists unique categories", () => {
    createTemplate("bot-1", "a", "...", "greeting");
    createTemplate("bot-1", "b", "...", "error");
    createTemplate("bot-1", "c", "...", "greeting");
    const cats = listCategories("bot-1");
    expect(cats).toEqual(["error", "greeting"]);
  });
});
