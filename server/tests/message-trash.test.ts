/**
 * Tests for message trash/recycle bin.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import {
  trashMessage,
  restoreFromTrash,
  listTrash,
  purgeExpiredTrash,
  clearTrash,
  trash,
} from "../src/services/message-trash";

const sampleMsg = {
  id: "msg-1",
  channelId: "ch-1",
  senderId: "user-1",
  content: "Hello world",
  mentions: null,
  parentId: null,
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  clearTrash();
});

describe("message-trash", () => {
  it("trashMessage stores a message", () => {
    trashMessage(sampleMsg, "user-1");
    expect(trash.size).toBe(1);
    expect(trash.get("msg-1")!.content).toBe("Hello world");
    expect(trash.get("msg-1")!.deletedBy).toBe("user-1");
  });

  it("restoreFromTrash returns and removes the message", () => {
    trashMessage(sampleMsg, "user-1");
    const restored = restoreFromTrash("msg-1");
    expect(restored).not.toBeNull();
    expect(restored!.id).toBe("msg-1");
    expect(trash.size).toBe(0);
  });

  it("restoreFromTrash returns null for missing message", () => {
    const result = restoreFromTrash("nonexistent");
    expect(result).toBeNull();
  });

  it("listTrash returns all trashed messages", () => {
    trashMessage(sampleMsg, "user-1");
    trashMessage({ ...sampleMsg, id: "msg-2", channelId: "ch-2" }, "user-1");
    expect(listTrash()).toHaveLength(2);
  });

  it("listTrash filters by channelId", () => {
    trashMessage(sampleMsg, "user-1");
    trashMessage({ ...sampleMsg, id: "msg-2", channelId: "ch-2" }, "user-1");
    expect(listTrash("ch-1")).toHaveLength(1);
    expect(listTrash("ch-2")).toHaveLength(1);
    expect(listTrash("ch-3")).toHaveLength(0);
  });

  it("purgeExpiredTrash removes old messages", () => {
    trashMessage(sampleMsg, "user-1");
    // Manually set deletedAt to 25 hours ago
    trash.get("msg-1")!.deletedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

    const purged = purgeExpiredTrash();
    expect(purged).toBe(1);
    expect(trash.size).toBe(0);
  });

  it("purgeExpiredTrash keeps recent messages", () => {
    trashMessage(sampleMsg, "user-1");
    const purged = purgeExpiredTrash();
    expect(purged).toBe(0);
    expect(trash.size).toBe(1);
  });

  it("clearTrash empties everything", () => {
    trashMessage(sampleMsg, "user-1");
    trashMessage({ ...sampleMsg, id: "msg-2" }, "user-1");
    clearTrash();
    expect(trash.size).toBe(0);
  });
});
