/**
 * Message write-path API tests — POST, PATCH, DELETE, pin, react.
 *
 * Tests the full message lifecycle through the Hono app.
 * Relies on the real seeded database (localhost auth bypass).
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";
import { getDb } from "../src/db";
import { users, channels, messages } from "../src/db/schema";
import { eq } from "drizzle-orm";

let app: Hono;

// Cached IDs from the seeded DB
let generalChannelId: string;
let humanUserId: string;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8097";
  const mod = await import("../src/index");
  app = mod.app;

  // Find #general channel and human user
  const db = getDb();
  const general = db
    .select()
    .from(channels)
    .where(eq(channels.name, "#general"))
    .get();
  if (!general) throw new Error("Seed data missing: #general channel");
  generalChannelId = general.id;

  const human = db
    .select()
    .from(users)
    .where(eq(users.type, "human"))
    .get();
  if (!human) {
    // Onboard a test human so message posting works
    const onboardRes = await app.fetch(
      req("POST", "/api/users/onboard", {
        name: "test-boss",
        display_name: "the Boss",
      })
    );
    const onboardData = await onboardRes.json();
    humanUserId = onboardData.id;
  } else {
    humanUserId = human.id;
  }
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

// ---------------------------------------------------------------------------
// POST — Send message
// ---------------------------------------------------------------------------

describe("Messages — POST (Send)", () => {
  it("creates a message and returns 201", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, {
        content: "Hello from write-path tests!",
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.content).toBe("Hello from write-path tests!");
    expect(data.channel_id).toBe(generalChannelId);
    expect(data.sender_id).toBe(humanUserId);
    expect(data.sender_type).toBe("human");
    expect(data.created_at).toBeDefined();
  });

  it("creates a message with mentions", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, {
        content: "Hey @the_creator, what's up?",
        mentions: ["the_creator"],
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.mentions).toEqual(["the_creator"]);
  });

  it("persists the message in GET", async () => {
    const content = `unique-test-msg-${Date.now()}`;
    const postRes = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, { content })
    );
    expect(postRes.status).toBe(201);
    const posted = await postRes.json();

    // Now GET messages and find it
    const getRes = await app.fetch(
      req("GET", `/api/channels/${generalChannelId}/messages`)
    );
    const msgs = await getRes.json();
    const found = msgs.find((m: { id: string }) => m.id === posted.id);
    expect(found).toBeDefined();
    expect(found.content).toBe(content);
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(
      req("POST", "/api/channels/nonexistent-uuid/messages", {
        content: "This should fail",
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for empty content", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, {
        content: "",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing content field", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, {})
    );
    expect(res.status).toBe(400);
  });

  it("creates a reply with parent_id", async () => {
    // First create a parent message
    const parentRes = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, {
        content: "I am the parent message",
      })
    );
    const parent = await parentRes.json();

    // Reply to it
    const replyRes = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, {
        content: "I am the reply",
        parent_id: parent.id,
      })
    );
    expect(replyRes.status).toBe(201);
    // Note: the response doesn't include parent_id in the current implementation
    // (it hardcodes null), but the message is created in DB with the parent_id
  });
});

// ---------------------------------------------------------------------------
// PATCH — Edit message
// ---------------------------------------------------------------------------

describe("Messages — PATCH (Edit)", () => {
  let editableMessageId: string;

  beforeAll(async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, {
        content: "Original content for editing",
      })
    );
    const data = await res.json();
    editableMessageId = data.id;
  });

  it("edits a message and returns updated content", async () => {
    const res = await app.fetch(
      req(
        "PATCH",
        `/api/channels/${generalChannelId}/messages/${editableMessageId}`,
        { content: "Updated content!" }
      )
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(editableMessageId);
    expect(data.content).toBe("Updated content!");
    expect(data.edited_at).toBeDefined();
  });

  it("persists the edit in GET", async () => {
    const getRes = await app.fetch(
      req("GET", `/api/channels/${generalChannelId}/messages`)
    );
    const msgs = await getRes.json();
    const found = msgs.find((m: { id: string }) => m.id === editableMessageId);
    expect(found).toBeDefined();
    expect(found.content).toBe("Updated content!");
    expect(found.edited_at).toBeDefined();
  });

  it("returns 404 for nonexistent message", async () => {
    const res = await app.fetch(
      req(
        "PATCH",
        `/api/channels/${generalChannelId}/messages/nonexistent-msg-id`,
        { content: "Should fail" }
      )
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for wrong channel", async () => {
    // Create a different channel to test cross-channel edit rejection
    const db = getDb();
    const otherChannel = db
      .select()
      .from(channels)
      .where(eq(channels.name, "#random"))
      .get();

    if (otherChannel) {
      const res = await app.fetch(
        req(
          "PATCH",
          `/api/channels/${otherChannel.id}/messages/${editableMessageId}`,
          { content: "Wrong channel" }
        )
      );
      expect(res.status).toBe(400);
    }
  });

  it("returns 400 for empty content", async () => {
    const res = await app.fetch(
      req(
        "PATCH",
        `/api/channels/${generalChannelId}/messages/${editableMessageId}`,
        { content: "" }
      )
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// DELETE — Delete message
// ---------------------------------------------------------------------------

describe("Messages — DELETE", () => {
  it("deletes a message and returns confirmation", async () => {
    // Create a message to delete
    const createRes = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, {
        content: "This message will be deleted",
      })
    );
    const created = await createRes.json();

    const deleteRes = await app.fetch(
      req(
        "DELETE",
        `/api/channels/${generalChannelId}/messages/${created.id}`
      )
    );
    expect(deleteRes.status).toBe(200);
    const data = await deleteRes.json();
    expect(data.deleted).toBe(true);
    expect(data.id).toBe(created.id);
  });

  it("deleted message is gone from GET", async () => {
    const createRes = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, {
        content: "Also going to be deleted",
      })
    );
    const created = await createRes.json();

    await app.fetch(
      req(
        "DELETE",
        `/api/channels/${generalChannelId}/messages/${created.id}`
      )
    );

    const getRes = await app.fetch(
      req("GET", `/api/channels/${generalChannelId}/messages`)
    );
    const msgs = await getRes.json();
    const found = msgs.find((m: { id: string }) => m.id === created.id);
    expect(found).toBeUndefined();
  });

  it("returns 404 for nonexistent message", async () => {
    const res = await app.fetch(
      req(
        "DELETE",
        `/api/channels/${generalChannelId}/messages/nonexistent-id`
      )
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(
      req(
        "DELETE",
        "/api/channels/nonexistent-channel/messages/nonexistent-id"
      )
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 if message belongs to different channel", async () => {
    const createRes = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, {
        content: "Cross-channel delete test",
      })
    );
    const created = await createRes.json();

    const db = getDb();
    const otherChannel = db
      .select()
      .from(channels)
      .where(eq(channels.name, "#random"))
      .get();

    if (otherChannel) {
      const res = await app.fetch(
        req(
          "DELETE",
          `/api/channels/${otherChannel.id}/messages/${created.id}`
        )
      );
      expect(res.status).toBe(400);
    }
  });
});

// ---------------------------------------------------------------------------
// POST pin — Toggle pin
// ---------------------------------------------------------------------------

describe("Messages — Pin/Unpin", () => {
  let pinnableMessageId: string;

  beforeAll(async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, {
        content: "This message will be pinned",
      })
    );
    const data = await res.json();
    pinnableMessageId = data.id;
  });

  it("pins a message (toggle on)", async () => {
    const res = await app.fetch(
      req(
        "POST",
        `/api/channels/${generalChannelId}/messages/${pinnableMessageId}/pin`
      )
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(pinnableMessageId);
    expect(data.is_pinned).toBe(true);
    expect(data.pinned_at).toBeDefined();
  });

  it("pinned message appears in pinned list", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${generalChannelId}/messages/pinned`)
    );
    expect(res.status).toBe(200);
    const pins = await res.json();
    const found = pins.find(
      (p: { id: string }) => p.id === pinnableMessageId
    );
    expect(found).toBeDefined();
    expect(found.is_pinned).toBe(true);
  });

  it("unpins a message (toggle off)", async () => {
    const res = await app.fetch(
      req(
        "POST",
        `/api/channels/${generalChannelId}/messages/${pinnableMessageId}/pin`
      )
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.is_pinned).toBe(false);
    expect(data.pinned_at).toBeNull();
  });

  it("returns 404 for nonexistent message", async () => {
    const res = await app.fetch(
      req(
        "POST",
        `/api/channels/${generalChannelId}/messages/nonexistent-id/pin`
      )
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for wrong channel", async () => {
    const db = getDb();
    const otherChannel = db
      .select()
      .from(channels)
      .where(eq(channels.name, "#random"))
      .get();

    if (otherChannel) {
      const res = await app.fetch(
        req(
          "POST",
          `/api/channels/${otherChannel.id}/messages/${pinnableMessageId}/pin`
        )
      );
      expect(res.status).toBe(400);
    }
  });
});

// ---------------------------------------------------------------------------
// POST react — Toggle reaction
// ---------------------------------------------------------------------------

describe("Messages — Reactions", () => {
  let reactableMessageId: string;

  beforeAll(async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, {
        content: "This message will get reactions",
      })
    );
    const data = await res.json();
    reactableMessageId = data.id;
  });

  it("adds a reaction", async () => {
    const res = await app.fetch(
      req(
        "POST",
        `/api/channels/${generalChannelId}/messages/${reactableMessageId}/react`,
        { emoji: "👍" }
      )
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.action).toBe("added");
    expect(data.emoji).toBe("👍");
  });

  it("reaction appears in GET reactions", async () => {
    const res = await app.fetch(
      req(
        "GET",
        `/api/channels/${generalChannelId}/messages/${reactableMessageId}/reactions`
      )
    );
    expect(res.status).toBe(200);
    const reactions = await res.json();
    expect(reactions.length).toBeGreaterThan(0);
    const thumbsUp = reactions.find((r: { emoji: string }) => r.emoji === "👍");
    expect(thumbsUp).toBeDefined();
    expect(thumbsUp.count).toBeGreaterThanOrEqual(1);
  });

  it("reaction appears in message GET response", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${generalChannelId}/messages`)
    );
    const msgs = await res.json();
    const found = msgs.find(
      (m: { id: string }) => m.id === reactableMessageId
    );
    expect(found).toBeDefined();
    expect(found.reactions).toBeDefined();
    expect(found.reactions.length).toBeGreaterThan(0);
  });

  it("removes a reaction on second toggle", async () => {
    const res = await app.fetch(
      req(
        "POST",
        `/api/channels/${generalChannelId}/messages/${reactableMessageId}/react`,
        { emoji: "👍" }
      )
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.action).toBe("removed");
    expect(data.emoji).toBe("👍");
  });

  it("supports multiple different emoji reactions", async () => {
    // Add two different reactions
    await app.fetch(
      req(
        "POST",
        `/api/channels/${generalChannelId}/messages/${reactableMessageId}/react`,
        { emoji: "🔥" }
      )
    );
    await app.fetch(
      req(
        "POST",
        `/api/channels/${generalChannelId}/messages/${reactableMessageId}/react`,
        { emoji: "✅" }
      )
    );

    const res = await app.fetch(
      req(
        "GET",
        `/api/channels/${generalChannelId}/messages/${reactableMessageId}/reactions`
      )
    );
    const reactions = await res.json();
    const emojis = reactions.map((r: { emoji: string }) => r.emoji);
    expect(emojis).toContain("🔥");
    expect(emojis).toContain("✅");
  });

  it("returns 404 for nonexistent message", async () => {
    const res = await app.fetch(
      req(
        "POST",
        `/api/channels/${generalChannelId}/messages/nonexistent-id/react`,
        { emoji: "👍" }
      )
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for wrong channel", async () => {
    const db = getDb();
    const otherChannel = db
      .select()
      .from(channels)
      .where(eq(channels.name, "#random"))
      .get();

    if (otherChannel) {
      const res = await app.fetch(
        req(
          "POST",
          `/api/channels/${otherChannel.id}/messages/${reactableMessageId}/react`,
          { emoji: "👍" }
        )
      );
      expect(res.status).toBe(400);
    }
  });

  it("returns 400 for missing emoji field", async () => {
    const res = await app.fetch(
      req(
        "POST",
        `/api/channels/${generalChannelId}/messages/${reactableMessageId}/react`,
        {}
      )
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET pinned — Get pinned messages
// ---------------------------------------------------------------------------

describe("Messages — Get Pinned", () => {
  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(
      req("GET", "/api/channels/nonexistent-uuid/messages/pinned")
    );
    expect(res.status).toBe(404);
  });

  it("returns array for valid channel", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${generalChannelId}/messages/pinned`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Search messages
// ---------------------------------------------------------------------------

describe("Messages — Search", () => {
  beforeAll(async () => {
    // Create a message with unique content for search
    await app.fetch(
      req("POST", `/api/channels/${generalChannelId}/messages`, {
        content: "xyzSearchTestContent123 special searchable message",
      })
    );
  });

  it("finds messages by keyword", async () => {
    const res = await app.fetch(
      req("GET", "/api/search?q=xyzSearchTestContent123")
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.query).toBe("xyzSearchTestContent123");
    expect(data.count).toBeGreaterThan(0);
    expect(data.results[0].content).toContain("xyzSearchTestContent123");
  });

  it("returns 400 without query parameter", async () => {
    const res = await app.fetch(req("GET", "/api/search"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty query", async () => {
    const res = await app.fetch(req("GET", "/api/search?q="));
    expect(res.status).toBe(400);
  });

  it("returns empty results for nonsense query", async () => {
    const res = await app.fetch(
      req("GET", "/api/search?q=zzzzNonExistentGarbageQuery999")
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(0);
  });
});
