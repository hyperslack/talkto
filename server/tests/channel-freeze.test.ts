/**
 * Tests for channel freeze.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import {
  freezeChannel,
  unfreezeChannel,
  isChannelFrozen,
  listFrozenChannels,
  clearAllFreezes,
} from "../src/services/channel-freeze";

beforeEach(() => {
  clearAllFreezes();
});

describe("channel-freeze", () => {
  it("freezeChannel stores freeze info", () => {
    const info = freezeChannel("ch-1", "admin-1", "Maintenance");
    expect(info.channelId).toBe("ch-1");
    expect(info.frozenBy).toBe("admin-1");
    expect(info.reason).toBe("Maintenance");
  });

  it("isChannelFrozen returns info for frozen channel", () => {
    freezeChannel("ch-1", "admin-1");
    const info = isChannelFrozen("ch-1");
    expect(info).not.toBeNull();
    expect(info!.channelId).toBe("ch-1");
  });

  it("isChannelFrozen returns null for unfrozen channel", () => {
    expect(isChannelFrozen("ch-1")).toBeNull();
  });

  it("unfreezeChannel removes freeze", () => {
    freezeChannel("ch-1", "admin-1");
    const removed = unfreezeChannel("ch-1");
    expect(removed).toBe(true);
    expect(isChannelFrozen("ch-1")).toBeNull();
  });

  it("unfreezeChannel returns false for non-frozen channel", () => {
    expect(unfreezeChannel("ch-999")).toBe(false);
  });

  it("auto-expires frozen channels", () => {
    // Freeze with -1ms duration (already expired)
    freezeChannel("ch-1", "admin-1", undefined, -1);
    const info = isChannelFrozen("ch-1");
    expect(info).toBeNull();
  });

  it("does not expire channels with future expiresAt", () => {
    freezeChannel("ch-1", "admin-1", undefined, 60_000);
    const info = isChannelFrozen("ch-1");
    expect(info).not.toBeNull();
  });

  it("listFrozenChannels returns all frozen channels", () => {
    freezeChannel("ch-1", "admin-1");
    freezeChannel("ch-2", "admin-1", "Testing");
    const list = listFrozenChannels();
    expect(list).toHaveLength(2);
  });

  it("listFrozenChannels cleans up expired entries", () => {
    freezeChannel("ch-1", "admin-1", undefined, -1); // already expired
    freezeChannel("ch-2", "admin-1", undefined, 60_000); // still active
    const list = listFrozenChannels();
    expect(list).toHaveLength(1);
    expect(list[0].channelId).toBe("ch-2");
  });
});
