/**
 * Tests for user avatar endpoint.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import { createTestDb, DEFAULT_WORKSPACE_ID, type TestDb } from "./setup";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
let userId: string;

beforeEach(() => {
  db = createTestDb();

  db.insert(schema.workspaces).values({
    id: DEFAULT_WORKSPACE_ID,
    name: "Test",
    slug: "test",
    type: "personal",
    createdBy: "system",
    createdAt: new Date().toISOString(),
  }).run();

  userId = crypto.randomUUID();
  db.insert(schema.users).values({
    id: userId,
    name: "testuser",
    type: "human",
    createdAt: new Date().toISOString(),
  }).run();
});

describe("User avatar", () => {
  it("can set avatar_url on user", () => {
    const url = "https://example.com/avatar.png";
    db.update(schema.users)
      .set({ avatarUrl: url })
      .where(eq(schema.users.id, userId))
      .run();

    const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get()!;
    expect(user.avatarUrl).toBe(url);
  });

  it("can clear avatar_url", () => {
    db.update(schema.users)
      .set({ avatarUrl: "https://example.com/old.png" })
      .where(eq(schema.users.id, userId))
      .run();

    db.update(schema.users)
      .set({ avatarUrl: null })
      .where(eq(schema.users.id, userId))
      .run();

    const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get()!;
    expect(user.avatarUrl).toBeNull();
  });

  it("avatar_url is null by default", () => {
    const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get()!;
    expect(user.avatarUrl).toBeNull();
  });

  it("avatar_url accepts valid URLs", () => {
    const urls = [
      "https://cdn.example.com/img/avatar.jpg",
      "https://gravatar.com/avatar/abc123",
      "https://i.imgur.com/photo.webp",
    ];
    for (const url of urls) {
      db.update(schema.users)
        .set({ avatarUrl: url })
        .where(eq(schema.users.id, userId))
        .run();
      const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get()!;
      expect(user.avatarUrl).toBe(url);
    }
  });
});
