import { describe, it, expect } from "bun:test";
import { CONFIRM_PRESETS, getSeverityColor } from "./confirm-action";

describe("CONFIRM_PRESETS", () => {
  it("has all expected presets", () => {
    expect(CONFIRM_PRESETS.deleteMessage).toBeDefined();
    expect(CONFIRM_PRESETS.deleteChannel).toBeDefined();
    expect(CONFIRM_PRESETS.archiveChannel).toBeDefined();
    expect(CONFIRM_PRESETS.leaveWorkspace).toBeDefined();
    expect(CONFIRM_PRESETS.deleteAgent).toBeDefined();
  });

  it("each preset has title and message", () => {
    for (const preset of Object.values(CONFIRM_PRESETS)) {
      expect(preset.title.length).toBeGreaterThan(0);
      expect(preset.message.length).toBeGreaterThan(0);
    }
  });

  it("danger presets have danger severity", () => {
    expect(CONFIRM_PRESETS.deleteMessage.severity).toBe("danger");
    expect(CONFIRM_PRESETS.deleteChannel.severity).toBe("danger");
    expect(CONFIRM_PRESETS.leaveWorkspace.severity).toBe("danger");
  });

  it("warning presets have warning severity", () => {
    expect(CONFIRM_PRESETS.archiveChannel.severity).toBe("warning");
    expect(CONFIRM_PRESETS.deleteAgent.severity).toBe("warning");
  });
});

describe("getSeverityColor", () => {
  it("returns destructive class for danger", () => {
    expect(getSeverityColor("danger")).toContain("destructive");
  });

  it("returns yellow class for warning", () => {
    expect(getSeverityColor("warning")).toContain("yellow");
  });

  it("returns primary class for info", () => {
    expect(getSeverityColor("info")).toContain("primary");
  });
});
