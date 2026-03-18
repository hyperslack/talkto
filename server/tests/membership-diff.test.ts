import { describe, expect, test } from "bun:test";
import {
  diffMemberships,
  hasMembershipChanged,
  formatDiffSummary,
  netChange,
  stableMembers,
  turnoverRate,
  type MemberSnapshot,
} from "../src/utils/membership-diff";

const before: MemberSnapshot[] = [
  { userId: "u1", role: "admin" },
  { userId: "u2", role: "member" },
  { userId: "u3", role: "member" },
];

const after: MemberSnapshot[] = [
  { userId: "u1", role: "admin" },
  { userId: "u2", role: "admin" }, // role changed
  { userId: "u4", role: "member" }, // joined
  // u3 left
];

describe("Membership Diff Utilities", () => {
  test("diffMemberships identifies joined members", () => {
    const diff = diffMemberships(before, after);
    expect(diff.joined).toHaveLength(1);
    expect(diff.joined[0].userId).toBe("u4");
  });

  test("diffMemberships identifies left members", () => {
    const diff = diffMemberships(before, after);
    expect(diff.left).toHaveLength(1);
    expect(diff.left[0].userId).toBe("u3");
  });

  test("diffMemberships identifies role changes", () => {
    const diff = diffMemberships(before, after);
    expect(diff.roleChanged).toHaveLength(1);
    expect(diff.roleChanged[0]).toEqual({
      userId: "u2",
      oldRole: "member",
      newRole: "admin",
    });
  });

  test("diffMemberships with identical snapshots", () => {
    const diff = diffMemberships(before, before);
    expect(diff.joined).toHaveLength(0);
    expect(diff.left).toHaveLength(0);
    expect(diff.roleChanged).toHaveLength(0);
  });

  test("hasMembershipChanged detects changes", () => {
    expect(hasMembershipChanged(before, after)).toBe(true);
  });

  test("hasMembershipChanged detects no changes", () => {
    expect(hasMembershipChanged(before, before)).toBe(false);
  });

  test("formatDiffSummary with all changes", () => {
    const diff = diffMemberships(before, after);
    const summary = formatDiffSummary(diff);
    expect(summary).toContain("Joined: u4");
    expect(summary).toContain("Left: u3");
    expect(summary).toContain("Role changed: u2 (member → admin)");
  });

  test("formatDiffSummary with name resolver", () => {
    const diff = diffMemberships(before, after);
    const names: Record<string, string> = { u3: "Charlie", u4: "Dana", u2: "Bob" };
    const summary = formatDiffSummary(diff, (id) => names[id] ?? id);
    expect(summary).toContain("Dana");
    expect(summary).toContain("Charlie");
  });

  test("formatDiffSummary with no changes", () => {
    const diff = diffMemberships(before, before);
    expect(formatDiffSummary(diff)).toBe("No changes");
  });

  test("netChange computes correctly", () => {
    const diff = diffMemberships(before, after);
    expect(netChange(diff)).toBe(0); // 1 joined, 1 left
  });

  test("stableMembers returns intersection", () => {
    const stable = stableMembers(before, after);
    expect(stable.sort()).toEqual(["u1", "u2"]);
  });

  test("turnoverRate computes correctly", () => {
    const rate = turnoverRate(before, after);
    // 1 joined + 1 left = 2 changes, max(3, 3) = 3
    expect(rate).toBeCloseTo(2 / 3, 2);
  });

  test("turnoverRate is 0 for no changes", () => {
    expect(turnoverRate(before, before)).toBe(0);
  });
});
