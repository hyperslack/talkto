import { describe, it, expect } from "bun:test";
import {
  computeMergePlan,
  canBeSource,
  mergeAnnouncement,
  estimateMergeDuration,
  type ChannelInfo,
} from "../src/lib/channel-merge";

const sourceChannel: ChannelInfo = {
  id: "ch1", name: "#project-alpha", memberIds: ["u1", "u2", "u3"],
  messageCount: 150, createdAt: "2025-01-01T00:00:00Z",
};

const targetChannel: ChannelInfo = {
  id: "ch2", name: "#project-beta", memberIds: ["u2", "u4"],
  messageCount: 300, createdAt: "2025-01-01T00:00:00Z",
};

describe("computeMergePlan", () => {
  it("computes correct merge plan", () => {
    const plan = computeMergePlan(sourceChannel, targetChannel);
    expect(plan.canMerge).toBe(true);
    expect(plan.messagesToMove).toBe(150);
    expect(plan.newMembersToAdd).toEqual(["u1", "u3"]);
    expect(plan.existingMembers).toEqual(["u2"]);
    expect(plan.totalMembersAfter).toBe(4); // u2, u4 + u1, u3
  });

  it("prevents merging a channel with itself", () => {
    const plan = computeMergePlan(sourceChannel, sourceChannel);
    expect(plan.canMerge).toBe(false);
    expect(plan.reason).toContain("itself");
  });

  it("handles no overlapping members", () => {
    const noOverlap: ChannelInfo = { ...sourceChannel, memberIds: ["u5", "u6"] };
    const plan = computeMergePlan(noOverlap, targetChannel);
    expect(plan.newMembersToAdd).toEqual(["u5", "u6"]);
    expect(plan.existingMembers).toEqual([]);
  });

  it("handles empty source channel", () => {
    const empty: ChannelInfo = { ...sourceChannel, memberIds: [], messageCount: 0 };
    const plan = computeMergePlan(empty, targetChannel);
    expect(plan.canMerge).toBe(true);
    expect(plan.messagesToMove).toBe(0);
    expect(plan.newMembersToAdd).toEqual([]);
  });
});

describe("canBeSource", () => {
  it("allows normal channels as source", () => {
    expect(canBeSource(sourceChannel).ok).toBe(true);
  });

  it("prevents #general from being a source", () => {
    const general: ChannelInfo = { ...sourceChannel, name: "#general" };
    const result = canBeSource(general);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("#general");
  });
});

describe("mergeAnnouncement", () => {
  it("generates correct announcement", () => {
    const msg = mergeAnnouncement("#alpha", "#beta", 42);
    expect(msg).toContain("#alpha");
    expect(msg).toContain("#beta");
    expect(msg).toContain("42 messages");
  });

  it("uses singular for 1 message", () => {
    const msg = mergeAnnouncement("#a", "#b", 1);
    expect(msg).toContain("1 message moved");
  });
});

describe("estimateMergeDuration", () => {
  it("returns at least 1 second", () => {
    expect(estimateMergeDuration(1).seconds).toBe(1);
  });

  it("scales with message count", () => {
    expect(estimateMergeDuration(5000).seconds).toBe(5);
  });

  it("shows minutes for large counts", () => {
    const result = estimateMergeDuration(120_000);
    expect(result.label).toContain("min");
  });
});
