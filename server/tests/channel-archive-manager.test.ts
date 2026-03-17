import { describe, it, expect } from "vitest";
import {
  isProtected,
  daysSinceLastMessage,
  buildArchivePlan,
  canArchive,
  canUnarchive,
  formatPlanSummary,
  type ChannelInfo,
} from "../src/utils/channel-archive-manager";

function makeCh(overrides: Partial<ChannelInfo> = {}): ChannelInfo {
  return {
    id: "ch1",
    name: "test",
    type: "custom",
    isArchived: false,
    lastMessageAt: "2025-01-01T00:00:00Z",
    memberCount: 5,
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("isProtected", () => {
  it("protects #general", () => {
    expect(isProtected(makeCh({ name: "general" }))).toBe(true);
  });

  it("protects DMs", () => {
    expect(isProtected(makeCh({ type: "dm" }))).toBe(true);
  });

  it("does not protect regular channels", () => {
    expect(isProtected(makeCh())).toBe(false);
  });
});

describe("daysSinceLastMessage", () => {
  it("returns null for no messages", () => {
    expect(daysSinceLastMessage(null)).toBeNull();
  });

  it("calculates days correctly", () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
    expect(daysSinceLastMessage(twoWeeksAgo)).toBe(14);
  });
});

describe("buildArchivePlan", () => {
  it("identifies inactive channels", () => {
    const old = new Date(Date.now() - 60 * 86400000).toISOString();
    const channels = [
      makeCh({ id: "1", name: "old-project", lastMessageAt: old }),
      makeCh({ id: "2", name: "active", lastMessageAt: new Date().toISOString() }),
      makeCh({ id: "3", name: "general" }),
    ];
    const plan = buildArchivePlan(channels, 30);
    expect(plan.totalCandidates).toBe(1);
    expect(plan.candidates[0].channel.name).toBe("old-project");
    expect(plan.protected).toHaveLength(1);
  });

  it("includes empty channels with no messages", () => {
    const channels = [makeCh({ lastMessageAt: null, memberCount: 0 })];
    const plan = buildArchivePlan(channels, 30);
    expect(plan.totalCandidates).toBe(1);
    expect(plan.candidates[0].reason).toContain("empty");
  });

  it("skips already archived channels", () => {
    const channels = [makeCh({ isArchived: true })];
    const plan = buildArchivePlan(channels, 30);
    expect(plan.totalCandidates).toBe(0);
  });
});

describe("canArchive", () => {
  it("allows archiving normal channels", () => {
    expect(canArchive(makeCh()).allowed).toBe(true);
  });

  it("blocks archiving protected channels", () => {
    expect(canArchive(makeCh({ name: "general" })).allowed).toBe(false);
  });

  it("blocks archiving already archived", () => {
    expect(canArchive(makeCh({ isArchived: true })).allowed).toBe(false);
  });
});

describe("canUnarchive", () => {
  it("allows unarchiving archived channels", () => {
    expect(canUnarchive(makeCh({ isArchived: true })).allowed).toBe(true);
  });

  it("blocks unarchiving non-archived", () => {
    expect(canUnarchive(makeCh()).allowed).toBe(false);
  });
});

describe("formatPlanSummary", () => {
  it("formats plan summary", () => {
    const plan = buildArchivePlan(
      [makeCh({ lastMessageAt: new Date(Date.now() - 60 * 86400000).toISOString() })],
      30
    );
    const summary = formatPlanSummary(plan);
    expect(summary).toContain("📦 Archive Plan");
    expect(summary).toContain("#test");
  });
});
