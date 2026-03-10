import { describe, it, expect } from "bun:test";
import { getConnectionStatus } from "./connection-status";

describe("getConnectionStatus", () => {
  it("returns connected when wsConnected is true", () => {
    const status = getConnectionStatus(true);
    expect(status.state).toBe("connected");
    expect(status.color).toBe("green");
    expect(status.label).toBe("Connected");
  });

  it("returns disconnected when wsConnected is false", () => {
    const status = getConnectionStatus(false);
    expect(status.state).toBe("disconnected");
    expect(status.color).toBe("red");
    expect(status.label).toBe("Disconnected");
  });

  it("returns connecting when reconnecting", () => {
    const status = getConnectionStatus(false, true);
    expect(status.state).toBe("connecting");
    expect(status.color).toBe("yellow");
    expect(status.label).toContain("Reconnecting");
  });

  it("connected takes priority over reconnecting flag", () => {
    const status = getConnectionStatus(true, true);
    expect(status.state).toBe("connected");
  });
});
