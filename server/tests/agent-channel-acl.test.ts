/**
 * Tests for agent channel ACL.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import {
  isAgentAllowed,
  setAgentChannels,
  getAgentChannels,
  clearAgentAcl,
  clearAllAcls,
} from "../src/services/agent-channel-acl";

beforeEach(() => {
  clearAllAcls();
});

describe("agent-channel-acl", () => {
  it("allows all channels by default (no ACL set)", () => {
    expect(isAgentAllowed("agent-1", "any-channel")).toBe(true);
  });

  it("restricts to allowed channels when ACL is set", () => {
    setAgentChannels("agent-1", ["ch-1", "ch-2"]);
    expect(isAgentAllowed("agent-1", "ch-1")).toBe(true);
    expect(isAgentAllowed("agent-1", "ch-2")).toBe(true);
    expect(isAgentAllowed("agent-1", "ch-3")).toBe(false);
  });

  it("empty ACL blocks all channels", () => {
    setAgentChannels("agent-1", []);
    expect(isAgentAllowed("agent-1", "ch-1")).toBe(false);
  });

  it("getAgentChannels returns null for unrestricted agents", () => {
    expect(getAgentChannels("agent-1")).toBeNull();
  });

  it("getAgentChannels returns channel list for restricted agents", () => {
    setAgentChannels("agent-1", ["ch-1", "ch-2"]);
    const channels = getAgentChannels("agent-1");
    expect(channels).toHaveLength(2);
    expect(channels).toContain("ch-1");
    expect(channels).toContain("ch-2");
  });

  it("clearAgentAcl restores full access", () => {
    setAgentChannels("agent-1", ["ch-1"]);
    expect(isAgentAllowed("agent-1", "ch-2")).toBe(false);
    clearAgentAcl("agent-1");
    expect(isAgentAllowed("agent-1", "ch-2")).toBe(true);
  });

  it("different agents have independent ACLs", () => {
    setAgentChannels("agent-1", ["ch-1"]);
    setAgentChannels("agent-2", ["ch-2"]);
    expect(isAgentAllowed("agent-1", "ch-1")).toBe(true);
    expect(isAgentAllowed("agent-1", "ch-2")).toBe(false);
    expect(isAgentAllowed("agent-2", "ch-1")).toBe(false);
    expect(isAgentAllowed("agent-2", "ch-2")).toBe(true);
  });
});
