import { describe, it, expect } from "vitest";
import {
  getInviteStatus,
  isUsable,
  buildInviteUrl,
  parseInviteUrl,
  remainingUses,
  formatInviteInfo,
  isValidTokenFormat,
  timeUntilExpiry,
  type InviteInfo,
} from "../src/utils/invite-token";

function makeInvite(overrides: Partial<InviteInfo> = {}): InviteInfo {
  return {
    token: "abc12345xyz",
    workspaceSlug: "my-workspace",
    role: "member",
    maxUses: null,
    useCount: 0,
    expiresAt: null,
    createdAt: "2025-01-01T00:00:00Z",
    revokedAt: null,
    ...overrides,
  };
}

describe("getInviteStatus", () => {
  it("returns valid for a fresh invite", () => {
    expect(getInviteStatus(makeInvite())).toBe("valid");
  });

  it("returns revoked when revokedAt is set", () => {
    expect(getInviteStatus(makeInvite({ revokedAt: "2025-01-01T01:00:00Z" }))).toBe("revoked");
  });

  it("returns expired when past expiresAt", () => {
    expect(getInviteStatus(makeInvite({ expiresAt: "2020-01-01T00:00:00Z" }))).toBe("expired");
  });

  it("returns exhausted when useCount >= maxUses", () => {
    expect(getInviteStatus(makeInvite({ maxUses: 5, useCount: 5 }))).toBe("exhausted");
  });

  it("revoked takes priority over expired", () => {
    expect(getInviteStatus(makeInvite({ revokedAt: "2025-01-01T00:00:00Z", expiresAt: "2020-01-01T00:00:00Z" }))).toBe("revoked");
  });
});

describe("isUsable", () => {
  it("true for valid invite", () => {
    expect(isUsable(makeInvite())).toBe(true);
  });

  it("false for expired invite", () => {
    expect(isUsable(makeInvite({ expiresAt: "2020-01-01T00:00:00Z" }))).toBe(false);
  });
});

describe("buildInviteUrl", () => {
  it("builds correct URL", () => {
    expect(buildInviteUrl("https://talkto.dev", "abc123")).toBe("https://talkto.dev/invite/abc123");
  });

  it("strips trailing slashes", () => {
    expect(buildInviteUrl("https://talkto.dev/", "abc123")).toBe("https://talkto.dev/invite/abc123");
  });
});

describe("parseInviteUrl", () => {
  it("extracts token from URL", () => {
    expect(parseInviteUrl("https://talkto.dev/invite/abc123")).toBe("abc123");
  });

  it("returns null for invalid URL", () => {
    expect(parseInviteUrl("https://talkto.dev/other")).toBeNull();
  });
});

describe("remainingUses", () => {
  it("returns null for unlimited", () => {
    expect(remainingUses(makeInvite())).toBeNull();
  });

  it("returns remaining count", () => {
    expect(remainingUses(makeInvite({ maxUses: 10, useCount: 3 }))).toBe(7);
  });

  it("returns 0 when exhausted", () => {
    expect(remainingUses(makeInvite({ maxUses: 5, useCount: 5 }))).toBe(0);
  });
});

describe("formatInviteInfo", () => {
  it("formats a valid invite", () => {
    const info = formatInviteInfo(makeInvite({ useCount: 2 }));
    expect(info).toContain("VALID");
    expect(info).toContain("my-workspace");
    expect(info).toContain("2/∞");
  });
});

describe("isValidTokenFormat", () => {
  it("accepts valid tokens", () => {
    expect(isValidTokenFormat("abc12345xyz")).toBe(true);
    expect(isValidTokenFormat("a-b_c-12345")).toBe(true);
  });

  it("rejects short tokens", () => {
    expect(isValidTokenFormat("abc")).toBe(false);
  });

  it("rejects tokens with special chars", () => {
    expect(isValidTokenFormat("abc!@#$%")).toBe(false);
  });
});

describe("timeUntilExpiry", () => {
  it("returns null for no expiry", () => {
    expect(timeUntilExpiry(makeInvite())).toBeNull();
  });

  it("returns 0 for expired", () => {
    expect(timeUntilExpiry(makeInvite({ expiresAt: "2020-01-01T00:00:00Z" }))).toBe(0);
  });

  it("returns positive for future expiry", () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const result = timeUntilExpiry(makeInvite({ expiresAt: future }));
    expect(result).toBeGreaterThan(0);
  });
});
