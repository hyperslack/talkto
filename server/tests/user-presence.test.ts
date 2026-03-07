/**
 * Tests for human user online status tracking.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import {
  setOnline,
  setOffline,
  setAway,
  getPresence,
  getAllPresence,
  getOnlineCount,
  clearPresence,
  setStatusText,
} from "../src/services/user-presence";

beforeEach(() => {
  clearPresence();
});

describe("User Presence", () => {
  it("sets user online", () => {
    const p = setOnline("user-1");
    expect(p.status).toBe("online");
    expect(p.user_id).toBe("user-1");
    expect(p.last_active_at).toBeTruthy();
  });

  it("sets user offline", () => {
    setOnline("user-1");
    const p = setOffline("user-1");
    expect(p.status).toBe("offline");
  });

  it("sets user away", () => {
    setOnline("user-1");
    const p = setAway("user-1");
    expect(p.status).toBe("away");
  });

  it("returns offline for unknown user", () => {
    const p = getPresence("unknown");
    expect(p.status).toBe("offline");
  });

  it("tracks online count", () => {
    setOnline("user-1");
    setOnline("user-2");
    setOffline("user-2");
    expect(getOnlineCount()).toBe(1);
  });

  it("lists all presence", () => {
    setOnline("user-1");
    setOnline("user-2");
    const all = getAllPresence();
    expect(all.length).toBe(2);
  });

  it("sets status text", () => {
    setOnline("user-1", "In a meeting");
    const p = getPresence("user-1");
    expect(p.status_text).toBe("In a meeting");
  });

  it("updates status text independently", () => {
    setOnline("user-1");
    setStatusText("user-1", "Coding");
    const p = getPresence("user-1");
    expect(p.status_text).toBe("Coding");
  });
});
