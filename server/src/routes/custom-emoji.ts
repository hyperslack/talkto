/**
 * Custom emoji CRUD endpoints.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../types";
import {
  addCustomEmoji,
  listCustomEmoji,
  deleteCustomEmoji,
} from "../services/custom-emoji";

const app = new Hono<AppBindings>();

const CreateEmojiSchema = z.object({
  shortcode: z.string().min(1).max(32),
  image_url: z.string().url(),
});

// GET /custom-emoji — list all custom emoji for the workspace
app.get("/", (c) => {
  const auth = c.get("auth");
  const emoji = listCustomEmoji(auth.workspaceId);
  return c.json(emoji);
});

// POST /custom-emoji — add a new custom emoji
app.post("/", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json();
  const parsed = CreateEmojiSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  try {
    const emoji = addCustomEmoji(
      auth.workspaceId,
      parsed.data.shortcode,
      parsed.data.image_url,
      auth.userId ?? "human"
    );
    return c.json(emoji, 201);
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
      return c.json({ error: "Shortcode already exists" }, 409);
    }
    if (err.message?.includes("must be 1-32")) {
      return c.json({ error: err.message }, 400);
    }
    throw err;
  }
});

// DELETE /custom-emoji/:emojiId — remove a custom emoji
app.delete("/:emojiId", (c) => {
  const auth = c.get("auth");
  const emojiId = c.req.param("emojiId");
  const deleted = deleteCustomEmoji(auth.workspaceId, emojiId);
  if (!deleted) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json({ ok: true });
});

export default app;
