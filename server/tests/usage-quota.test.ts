import { describe, expect, test } from "bun:test";
import {
  checkResource,
  checkAllQuotas,
  isAnyQuotaExceeded,
  getMostUsedQuota,
  formatQuotaCheck,
  formatQuotaSummary,
  wouldExceedQuota,
  DEFAULT_QUOTA,
  type UsageSnapshot,
} from "../src/utils/usage-quota";

const usage: UsageSnapshot = {
  channels: 10,
  members: 50,
  agents: 5,
  messagesToday: 1000,
  storageUsedMb: 10,
};

describe("Usage Quota Utilities", () => {
  test("checkResource within limit", () => {
    const check = checkResource("channels", 10, 50);
    expect(check.exceeded).toBe(false);
    expect(check.used).toBe(20);
    expect(check.remaining).toBe(40);
  });

  test("checkResource at limit", () => {
    const check = checkResource("channels", 50, 50);
    expect(check.exceeded).toBe(true);
    expect(check.remaining).toBe(0);
  });

  test("checkResource over limit", () => {
    const check = checkResource("channels", 60, 50);
    expect(check.exceeded).toBe(true);
    expect(check.used).toBe(100); // clamped
  });

  test("checkAllQuotas returns all resources", () => {
    const checks = checkAllQuotas(usage);
    expect(checks).toHaveLength(4);
    expect(checks.map((c) => c.resource)).toContain("channels");
    expect(checks.map((c) => c.resource)).toContain("agents");
  });

  test("isAnyQuotaExceeded returns false when under limit", () => {
    expect(isAnyQuotaExceeded(usage)).toBe(false);
  });

  test("isAnyQuotaExceeded returns true when over limit", () => {
    const over = { ...usage, agents: 10 };
    expect(isAnyQuotaExceeded(over)).toBe(true);
  });

  test("getMostUsedQuota returns highest usage", () => {
    const most = getMostUsedQuota(usage);
    expect(most.resource).toBe("members"); // 50/100 = 50%
  });

  test("formatQuotaCheck formats correctly", () => {
    const check = checkResource("channels", 10, 50);
    expect(formatQuotaCheck(check)).toBe("channels: 10/50 (20%)");
  });

  test("formatQuotaCheck shows exceeded", () => {
    const check = checkResource("agents", 10, 10);
    expect(formatQuotaCheck(check)).toContain("EXCEEDED");
  });

  test("formatQuotaSummary includes all resources", () => {
    const summary = formatQuotaSummary(usage);
    expect(summary).toContain("channels");
    expect(summary).toContain("members");
    expect(summary).toContain("agents");
  });

  test("wouldExceedQuota returns false when safe", () => {
    expect(wouldExceedQuota("channels", usage)).toBe(false);
  });

  test("wouldExceedQuota returns true when at limit", () => {
    const atLimit = { ...usage, agents: 10 };
    expect(wouldExceedQuota("agents", atLimit)).toBe(true);
  });

  test("wouldExceedQuota with custom increment", () => {
    const near = { ...usage, agents: 8 };
    expect(wouldExceedQuota("agents", near, DEFAULT_QUOTA, 3)).toBe(true);
    expect(wouldExceedQuota("agents", near, DEFAULT_QUOTA, 2)).toBe(false);
  });
});
