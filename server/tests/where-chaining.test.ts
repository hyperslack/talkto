/**
 * Tests for Drizzle .where() chaining bug fixes.
 *
 * Verifies that cursor pagination, pinned messages, and search
 * correctly scope results to the requested channel instead of
 * leaking data from other channels.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";
import { getDb } from "../src/db";
import { users, channels, messages } from "../src/db/schema";
import { eq } from "drizzle-orm";

let app: Hono;

// Cached IDs from the seeded DB
let generalChannelId: string;
let randomChannelId: string;
let humanUserId: string;

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

beforeAll(async () => {
  process.env.TALKTO_PORT = "8098";
  const mod = await import("../src/index");
  app = mod.app;

  const db = getDb();

  // Find #general and #random channels
  const general = db.select().from(channels).where(eq(channels.name, "#general")).get();
  if (!general) throw new Error("Seed data missing: #general channel");
  generalChannelId = general.id;

  const random = db.select().from(channels).where(eq(channels.name, "#random")).get();
  if (!random) throw new Error("Seed data missing: #random channel");
  randomChannelId = random.id;

  // Ensure a human user exists
  const human = db.select().from(users).where(eq(users.type, "human")).get();
  if (!human) {
    const onboardRes = await app.fetch(
      req("POST", "/api/users/onboard", {
        name: "test-boss",
        display_name: "the Boss",
      })
    );
    const data = await onboardRes.json();
    humanUserId = data.id;
  } else {
    humanUserId = human.id;
  }
});

// Helper to post a message and return its data
async function postMessage(channelId: string, content: string) {
  const res = await app.fetch(
    req("POST", `/api/channels/${channelId}/messages`, { content })
  );
  expect(res.status).toBe(201);
  return res.json();
}

// Helper to pin a message
async function pinMessage(channelId: string, messageId: string) {
  const res = await app.fetch(
    req("POST", `/api/channels/${channelId}/messages/${messageId}/pin`)
  );
  expect(res.status).toBe(200);
  return res.json();
}

// ---------------------------------------------------------------------------
// Bug #1: Cursor pagination leaks messages from other channels
// ---------------------------------------------------------------------------

describe("Cursor pagination — channel scoping", () => {
  let generalMsgIds: string[];
  let randomMsgId: string;

  beforeAll(async () => {
    // Create 3 messages in #general with small time gaps
    generalMsgIds = [];
    for (let i = 0; i < 3; i++) {
      const data = await postMessage(generalChannelId, `cursor-test-general-${i}-${Date.now()}`);
      generalMsgIds.push(data.id);
      // Small delay to ensure distinct createdAt timestamps
      await new Promise((r) => setTimeout(r, 10));
    }

    // Create 1 message in #random
    const data = await postMessage(randomChannelId, `cursor-test-random-${Date.now()}`);
    randomMsgId = data.id;
  });

  it("returns only #general messages when paginating #general", async () => {
    // Use the last #general message as cursor (get messages before it)
    const lastId = generalMsgIds[generalMsgIds.length - 1];
    const res = await app.fetch(
      req("GET", `/api/channels/${generalChannelId}/messages?before=${lastId}&limit=100`)
    );
    expect(res.status).toBe(200);
    const msgs = await res.json();

    // Every returned message must belong to #general
    for (const msg of msgs) {
      expect(msg.channel_id).toBe(generalChannelId);
    }

    // The #random message must NOT appear
    const leaked = msgs.find((m: { id: string }) => m.id === randomMsgId);
    expect(leaked).toBeUndefined();
  });

  it("returns only #random messages when paginating #random", async () => {
    // First post another message in #random so we have something to paginate from
    await new Promise((r) => setTimeout(r, 10));
    const anchor = await postMessage(randomChannelId, `cursor-anchor-random-${Date.now()}`);

    const res = await app.fetch(
      req("GET", `/api/channels/${randomChannelId}/messages?before=${anchor.id}&limit=100`)
    );
    expect(res.status).toBe(200);
    const msgs = await res.json();

    // Every returned message must belong to #random
    for (const msg of msgs) {
      expect(msg.channel_id).toBe(randomChannelId);
    }
  });
});

// ---------------------------------------------------------------------------
// Bug #2: Pinned messages leaks pins from other channels
// ---------------------------------------------------------------------------

describe("Pinned messages — channel scoping", () => {
  let generalPinnedId: string;
  let randomPinnedId: string;

  beforeAll(async () => {
    // Create and pin a message in #general
    const gMsg = await postMessage(generalChannelId, `pin-test-general-${Date.now()}`);
    generalPinnedId = gMsg.id;
    await pinMessage(generalChannelId, generalPinnedId);

    // Create and pin a message in #random
    const rMsg = await postMessage(randomChannelId, `pin-test-random-${Date.now()}`);
    randomPinnedId = rMsg.id;
    await pinMessage(randomChannelId, randomPinnedId);
  });

  it("GET pinned for #general returns only #general pins", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${generalChannelId}/messages/pinned`)
    );
    expect(res.status).toBe(200);
    const pins = await res.json();

    // All pins should be from #general
    for (const pin of pins) {
      expect(pin.channel_id).toBe(generalChannelId);
    }

    // The #random pin must NOT appear
    const leaked = pins.find((p: { id: string }) => p.id === randomPinnedId);
    expect(leaked).toBeUndefined();

    // The #general pin must appear
    const found = pins.find((p: { id: string }) => p.id === generalPinnedId);
    expect(found).toBeDefined();
  });

  it("GET pinned for #random returns only #random pins", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${randomChannelId}/messages/pinned`)
    );
    expect(res.status).toBe(200);
    const pins = await res.json();

    // All pins should be from #random
    for (const pin of pins) {
      expect(pin.channel_id).toBe(randomChannelId);
    }

    // The #general pin must NOT appear
    const leaked = pins.find((p: { id: string }) => p.id === generalPinnedId);
    expect(leaked).toBeUndefined();

    // The #random pin must appear
    const found = pins.find((p: { id: string }) => p.id === randomPinnedId);
    expect(found).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Bug #3: Search with channel filter replaces text filter
// ---------------------------------------------------------------------------

describe("Search — channel filter preserves text filter", () => {
  const uniqueTag = `searchbug-${Date.now()}`;

  beforeAll(async () => {
    // Create a message with the unique tag in #general
    await postMessage(generalChannelId, `${uniqueTag} in general channel`);
    // Create a different message in #random (no unique tag)
    await postMessage(randomChannelId, `completely unrelated content in random`);
    // Create a message with the unique tag in #random too
    await postMessage(randomChannelId, `${uniqueTag} in random channel`);
  });

  it("search with channel filter still applies text filter", async () => {
    // Search for the unique tag, filtered to #general
    const res = await app.fetch(
      req("GET", `/api/search?q=${uniqueTag}&channel=%23general`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    // Should find the message with uniqueTag in #general
    expect(data.count).toBeGreaterThanOrEqual(1);

    // Every result must contain the unique tag AND be in #general
    for (const result of data.results) {
      expect(result.content).toContain(uniqueTag);
      expect(result.channel_name).toBe("#general");
    }
  });

  it("search with channel filter does not return unrelated messages from that channel", async () => {
    // Search for a very specific term filtered to #random
    const res = await app.fetch(
      req("GET", `/api/search?q=${uniqueTag}&channel=%23random`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    // Should find only the message with uniqueTag in #random, not the unrelated one
    for (const result of data.results) {
      expect(result.content).toContain(uniqueTag);
      expect(result.channel_name).toBe("#random");
    }
  });

  it("search without channel filter returns results from all channels", async () => {
    const res = await app.fetch(
      req("GET", `/api/search?q=${uniqueTag}`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    // Should find the unique tag in both #general and #random
    expect(data.count).toBeGreaterThanOrEqual(2);
    const channelNames = data.results.map((r: { channel_name: string }) => r.channel_name);
    expect(channelNames).toContain("#general");
    expect(channelNames).toContain("#random");
  });
});

// ---------------------------------------------------------------------------
// Bug #22: LIKE wildcards in search not escaped
// ---------------------------------------------------------------------------

describe("Search — LIKE wildcard escaping", () => {
  beforeAll(async () => {
    // Create messages with known content
    await postMessage(generalChannelId, "This contains a literal percent % sign");
    await postMessage(generalChannelId, "This contains an underscore _ char");
    await postMessage(generalChannelId, "Normal message without wildcards");
  });

  it("searching for '%' does not match everything", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=%25"));
    expect(res.status).toBe(200);
    const data = await res.json();

    // Should only find messages that literally contain '%'
    for (const result of data.results) {
      expect(result.content).toContain("%");
    }

    // Should NOT match "Normal message without wildcards"
    const normal = data.results.find(
      (r: { content: string }) => r.content === "Normal message without wildcards"
    );
    expect(normal).toBeUndefined();
  });

  it("searching for '_' does not match single-character wildcards", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=_"));
    expect(res.status).toBe(200);
    const data = await res.json();

    // Should only find messages that literally contain '_'
    for (const result of data.results) {
      expect(result.content).toContain("_");
    }
  });
});
