/**
 * Tests for incoming webhook endpoint.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import { createTestDb, DEFAULT_WORKSPACE_ID, type TestDb } from "./setup";
import * as schema from "../src/db/schema";

let db: TestDb;
let channelId: string;
let userId: string;

beforeEach(() => {
  db = createTestDb();

  // Seed workspace
  db.insert(schema.workspaces).values({
    id: DEFAULT_WORKSPACE_ID,
    name: "Test Workspace",
    slug: "test",
    type: "personal",
    createdBy: "system",
    createdAt: new Date().toISOString(),
  }).run();

  // Seed user
  userId = crypto.randomUUID();
  db.insert(schema.users).values({
    id: userId,
    name: "testuser",
    type: "human",
    createdAt: new Date().toISOString(),
  }).run();

  // Seed channel
  channelId = crypto.randomUUID();
  db.insert(schema.channels).values({
    id: channelId,
    name: "#general",
    type: "general",
    createdBy: userId,
    createdAt: new Date().toISOString(),
    workspaceId: DEFAULT_WORKSPACE_ID,
  }).run();
});

describe("WebhookMessageSchema", () => {
  it("validates a correct webhook payload", async () => {
    const { WebhookMessageSchema } = await import("../src/routes/webhooks");
    const result = WebhookMessageSchema.safeParse({
      channel_id: crypto.randomUUID(),
      sender_name: "GitHub Bot",
      content: "New PR opened: #42",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", async () => {
    const { WebhookMessageSchema } = await import("../src/routes/webhooks");
    const result = WebhookMessageSchema.safeParse({
      channel_id: crypto.randomUUID(),
      sender_name: "Bot",
      content: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing sender_name", async () => {
    const { WebhookMessageSchema } = await import("../src/routes/webhooks");
    const result = WebhookMessageSchema.safeParse({
      channel_id: crypto.randomUUID(),
      content: "hello",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional avatar_url", async () => {
    const { WebhookMessageSchema } = await import("../src/routes/webhooks");
    const result = WebhookMessageSchema.safeParse({
      channel_id: crypto.randomUUID(),
      sender_name: "Bot",
      content: "hello",
      avatar_url: "https://example.com/avatar.png",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid avatar_url", async () => {
    const { WebhookMessageSchema } = await import("../src/routes/webhooks");
    const result = WebhookMessageSchema.safeParse({
      channel_id: crypto.randomUUID(),
      sender_name: "Bot",
      content: "hello",
      avatar_url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});
