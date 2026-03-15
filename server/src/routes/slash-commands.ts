/**
 * Slash command registry — register and list available slash commands.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../types";

interface SlashCommand {
  name: string;
  description: string;
  usage: string;
  category: string;
  agentOnly: boolean;
  createdAt: string;
}

// Built-in commands
const commands: SlashCommand[] = [
  {
    name: "/help",
    description: "Show available slash commands",
    usage: "/help [command]",
    category: "general",
    agentOnly: false,
    createdAt: new Date().toISOString(),
  },
  {
    name: "/status",
    description: "Set your status emoji and text",
    usage: "/status :emoji: [text]",
    category: "general",
    agentOnly: false,
    createdAt: new Date().toISOString(),
  },
  {
    name: "/topic",
    description: "Set the channel topic",
    usage: "/topic [new topic text]",
    category: "channel",
    agentOnly: false,
    createdAt: new Date().toISOString(),
  },
  {
    name: "/mute",
    description: "Mute notifications for current channel",
    usage: "/mute [duration]",
    category: "notifications",
    agentOnly: false,
    createdAt: new Date().toISOString(),
  },
  {
    name: "/invite",
    description: "Invite an agent to the current channel",
    usage: "/invite @agent-name",
    category: "channel",
    agentOnly: false,
    createdAt: new Date().toISOString(),
  },
];

const RegisterCommandSchema = z.object({
  name: z.string().min(2).max(32).regex(/^\/[a-z][a-z0-9_-]*$/),
  description: z.string().min(1).max(200),
  usage: z.string().max(200).optional(),
  category: z.string().max(50).optional(),
  agent_only: z.boolean().optional(),
});

const app = new Hono<AppBindings>();

// GET /slash-commands — list all available commands
app.get("/", (c) => {
  const category = c.req.query("category");
  let result = commands;
  if (category) {
    result = commands.filter((cmd) => cmd.category === category);
  }
  return c.json(
    result.map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
      usage: cmd.usage,
      category: cmd.category,
      agent_only: cmd.agentOnly,
    }))
  );
});

// GET /slash-commands/:name — get a specific command
app.get("/:name", (c) => {
  const name = c.req.param("name");
  const cmdName = name.startsWith("/") ? name : `/${name}`;
  const cmd = commands.find((c) => c.name === cmdName);
  if (!cmd) return c.json({ detail: "Command not found" }, 404);
  return c.json({
    name: cmd.name,
    description: cmd.description,
    usage: cmd.usage,
    category: cmd.category,
    agent_only: cmd.agentOnly,
  });
});

// POST /slash-commands — register a custom command
app.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ detail: "Invalid JSON body" }, 400);

  const parsed = RegisterCommandSchema.safeParse(body);
  if (!parsed.success) return c.json({ detail: parsed.error.message }, 400);

  const existing = commands.find((cmd) => cmd.name === parsed.data.name);
  if (existing) return c.json({ detail: "Command already exists" }, 409);

  const cmd: SlashCommand = {
    name: parsed.data.name,
    description: parsed.data.description,
    usage: parsed.data.usage ?? parsed.data.name,
    category: parsed.data.category ?? "custom",
    agentOnly: parsed.data.agent_only ?? false,
    createdAt: new Date().toISOString(),
  };
  commands.push(cmd);

  return c.json(
    {
      name: cmd.name,
      description: cmd.description,
      usage: cmd.usage,
      category: cmd.category,
      agent_only: cmd.agentOnly,
    },
    201
  );
});

export default app;
