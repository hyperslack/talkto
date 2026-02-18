/**
 * Prompt template engine — loads and renders markdown templates from prompts/.
 *
 * Replaces Jinja2 with simple {{ variable }} substitution.
 * Templates use Jinja2-style {{ var }} syntax which we replace with values.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { config } from "../lib/config";

class PromptEngine {
  private dir: string;

  constructor(promptsDir?: string) {
    this.dir = promptsDir ?? config.promptsDir;
  }

  /** Render a template file with variable substitution */
  render(templateName: string, vars: Record<string, string> = {}): string {
    const filePath = join(this.dir, templateName);
    if (!existsSync(filePath)) {
      console.warn(`[PROMPT] Template not found: ${filePath}`);
      return "";
    }

    let content = readFileSync(filePath, "utf-8");

    // Handle Jinja2 {% include "file" %} directives
    content = content.replace(
      /\{%[-\s]*include\s+['"](.*?)['"]\s*[-]?%\}/g,
      (_match, includePath: string) => {
        const includeFile = join(this.dir, includePath);
        if (existsSync(includeFile)) {
          return readFileSync(includeFile, "utf-8");
        }
        console.warn(`[PROMPT] Include not found: ${includeFile}`);
        return "";
      }
    );

    // Handle Jinja2 {% if var %} ... {% endif %} blocks
    content = content.replace(
      /\{%[-\s]*if\s+(\w+)\s*[-]?%\}([\s\S]*?)\{%[-\s]*endif\s*[-]?%\}/g,
      (_match, varName: string, block: string) => {
        const value = vars[varName];
        if (value && value.trim() !== "") {
          return block;
        }
        return "";
      }
    );

    // Replace {{ variable }} with values
    for (const [key, value] of Object.entries(vars)) {
      content = content.replace(
        new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"),
        value
      );
    }

    return content;
  }

  /** Render the master prompt sent to agents on registration */
  renderMasterPrompt(opts: {
    agentName: string;
    agentType: string;
    projectName: string;
    projectChannel: string;
    operatorName?: string;
    operatorDisplayName?: string;
    operatorAbout?: string;
    operatorInstructions?: string;
  }): string {
    return this.render("master_prompt.md", {
      agent_name: opts.agentName,
      agent_type: opts.agentType,
      project_name: opts.projectName,
      project_channel: opts.projectChannel,
      operator_name: opts.operatorName ?? "",
      operator_display_name: opts.operatorDisplayName ?? "",
      operator_about: opts.operatorAbout ?? "",
      operator_instructions: opts.operatorInstructions ?? "",
    });
  }

  /** Render the text agents inject into their rules files */
  renderRegistrationRules(opts: {
    agentName: string;
    projectChannel: string;
  }): string {
    return this.render("registration_rules.md", {
      agent_name: opts.agentName,
      project_channel: opts.projectChannel,
    });
  }
}

/** Singleton instance */
export const promptEngine = new PromptEngine();
