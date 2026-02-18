/**
 * User onboarding & profile endpoints.
 */

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users, channels, messages } from "../db/schema";
import { UserOnboardSchema } from "../types";
import { broadcastEvent, newMessageEvent } from "../services/broadcaster";
import { CREATOR_NAME } from "../services/name-generator";
import type { UserResponse } from "../types";

const app = new Hono();

function userToResponse(u: typeof users.$inferSelect): UserResponse {
  return {
    id: u.id,
    name: u.name,
    type: u.type,
    created_at: u.createdAt,
    display_name: u.displayName,
    about: u.about,
    agent_instructions: u.agentInstructions,
  };
}

/** Have the_creator post a welcome for the new human operator in #general */
function postCreatorWelcome(displayName: string, about: string | null): void {
  const db = getDb();

  const creator = db
    .select()
    .from(users)
    .where(eq(users.name, CREATOR_NAME))
    .get();
  if (!creator) return;

  const general = db
    .select()
    .from(channels)
    .where(eq(channels.name, "#general"))
    .get();
  if (!general) return;

  const aboutLine = about ? ` They say: *"${about.slice(0, 200)}"*` : "";

  const msgId = crypto.randomUUID();
  const now = new Date().toISOString();
  const content =
    `Everyone, meet **${displayName}** — ` +
    `they're running the show around here.${aboutLine}\n\n` +
    "Be cool. Be yourself. Make a good impression.";

  db.insert(messages)
    .values({
      id: msgId,
      channelId: general.id,
      senderId: creator.id,
      content,
      createdAt: now,
    })
    .run();

  broadcastEvent(
    newMessageEvent({
      messageId: msgId,
      channelId: general.id,
      senderId: creator.id,
      senderName: CREATOR_NAME,
      content,
      createdAt: now,
      senderType: "agent",
    })
  );
}

// POST /users/onboard
app.post("/onboard", async (c) => {
  const body = await c.req.json();
  const parsed = UserOnboardSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ detail: parsed.error.message }, 400);
  }
  const data = parsed.data;
  const db = getDb();

  // Check if human already exists
  const existing = db
    .select()
    .from(users)
    .where(eq(users.type, "human"))
    .get();

  if (existing) {
    // Re-onboard: update fields
    db.update(users)
      .set({
        name: data.name,
        displayName: data.display_name ?? null,
        about: data.about ?? null,
        agentInstructions: data.agent_instructions ?? null,
      })
      .where(eq(users.id, existing.id))
      .run();

    const updated = db.select().from(users).where(eq(users.id, existing.id)).get()!;
    return c.json(userToResponse(updated), 201);
  }

  // New onboard
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.insert(users)
    .values({
      id: userId,
      name: data.name,
      type: "human",
      createdAt: now,
      displayName: data.display_name ?? null,
      about: data.about ?? null,
      agentInstructions: data.agent_instructions ?? null,
    })
    .run();

  // Fire-and-forget: creator welcome
  const welcomeName = data.display_name ?? data.name;
  try {
    postCreatorWelcome(welcomeName, data.about ?? null);
  } catch (e) {
    console.error("Failed to post creator welcome:", e);
  }

  const user = db.select().from(users).where(eq(users.id, userId)).get()!;
  return c.json(userToResponse(user), 201);
});

// GET /users/me
app.get("/me", (c) => {
  const db = getDb();
  const user = db.select().from(users).where(eq(users.type, "human")).get();
  if (!user) {
    return c.json({ detail: "No human user onboarded yet" }, 404);
  }
  return c.json(userToResponse(user));
});

// PATCH /users/me
app.patch("/me", async (c) => {
  const body = await c.req.json();
  const parsed = UserOnboardSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ detail: parsed.error.message }, 400);
  }
  const data = parsed.data;
  const db = getDb();

  const user = db.select().from(users).where(eq(users.type, "human")).get();
  if (!user) {
    return c.json({ detail: "No human user onboarded yet" }, 404);
  }

  db.update(users)
    .set({
      name: data.name,
      displayName: data.display_name ?? null,
      about: data.about ?? null,
      agentInstructions: data.agent_instructions ?? null,
    })
    .where(eq(users.id, user.id))
    .run();

  const updated = db.select().from(users).where(eq(users.id, user.id)).get()!;
  return c.json(userToResponse(updated));
});

// DELETE /users/me
app.delete("/me", (c) => {
  const db = getDb();
  const user = db.select().from(users).where(eq(users.type, "human")).get();
  if (user) {
    console.warn(
      `Deleting human user '${user.displayName ?? user.name}' (id=${user.id})`
    );
    db.delete(users).where(eq(users.id, user.id)).run();
  }
  return c.body(null, 204);
});

export default app;
