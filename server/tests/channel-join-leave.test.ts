/**
 * Tests for channel join/leave endpoints.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import { createTestDb, DEFAULT_WORKSPACE_ID, type TestDb } from "./setup";
import * as schema from "../src/db/schema";
import { eq, and } from "drizzle-orm";

let db: TestDb;
let userId: string;
let channelId: string;
let generalId: string;

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

  generalId = crypto.randomUUID();
  db.insert(schema.channels).values({
    id: generalId,
    name: "#general",
    type: "general",
    createdBy: userId,
    createdAt: new Date().toISOString(),
    workspaceId: DEFAULT_WORKSPACE_ID,
  }).run();

  channelId = crypto.randomUUID();
  db.insert(schema.channels).values({
    id: channelId,
    name: "#random",
    type: "custom",
    createdBy: userId,
    createdAt: new Date().toISOString(),
    workspaceId: DEFAULT_WORKSPACE_ID,
  }).run();
});

describe("Channel join/leave", () => {
  it("can join a channel", () => {
    const now = new Date().toISOString();
    db.insert(schema.channelMembers).values({
      channelId,
      userId,
      joinedAt: now,
    }).run();

    const member = db
      .select()
      .from(schema.channelMembers)
      .where(and(
        eq(schema.channelMembers.channelId, channelId),
        eq(schema.channelMembers.userId, userId)
      ))
      .get();

    expect(member).toBeTruthy();
    expect(member!.channelId).toBe(channelId);
  });

  it("can leave a channel", () => {
    const now = new Date().toISOString();
    db.insert(schema.channelMembers).values({
      channelId,
      userId,
      joinedAt: now,
    }).run();

    db.delete(schema.channelMembers)
      .where(and(
        eq(schema.channelMembers.channelId, channelId),
        eq(schema.channelMembers.userId, userId)
      ))
      .run();

    const member = db
      .select()
      .from(schema.channelMembers)
      .where(and(
        eq(schema.channelMembers.channelId, channelId),
        eq(schema.channelMembers.userId, userId)
      ))
      .get();

    expect(member).toBeUndefined();
  });

  it("cannot join the same channel twice (PK constraint)", () => {
    const now = new Date().toISOString();
    db.insert(schema.channelMembers).values({
      channelId,
      userId,
      joinedAt: now,
    }).run();

    expect(() => {
      db.insert(schema.channelMembers).values({
        channelId,
        userId,
        joinedAt: now,
      }).run();
    }).toThrow();
  });

  it("leaving a non-joined channel has no effect", () => {
    const result = db.delete(schema.channelMembers)
      .where(and(
        eq(schema.channelMembers.channelId, channelId),
        eq(schema.channelMembers.userId, userId)
      ))
      .run();

    // Should not throw, just no rows affected
    expect(result.changes).toBe(0);
  });
});
