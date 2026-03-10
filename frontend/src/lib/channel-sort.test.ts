import { describe, it, expect } from "bun:test";
import { sortChannels } from "./channel-sort";
import type { Channel } from "./types";

function ch(name: string, type: Channel["type"], created_at: string): Channel {
  return { id: name, name, type, project_path: null, created_by: "u1", created_at };
}

const channels: Channel[] = [
  ch("beta", "custom", "2025-01-02T00:00:00Z"),
  ch("alpha", "general", "2025-01-03T00:00:00Z"),
  ch("gamma", "project", "2025-01-01T00:00:00Z"),
  ch("dm-bot", "dm", "2025-01-04T00:00:00Z"),
];

describe("sortChannels", () => {
  it("sorts by name alphabetically", () => {
    const result = sortChannels(channels, "name");
    expect(result.map((c) => c.name)).toEqual(["alpha", "beta", "dm-bot", "gamma"]);
  });

  it("sorts by created date (newest first)", () => {
    const result = sortChannels(channels, "created");
    expect(result.map((c) => c.name)).toEqual(["dm-bot", "alpha", "beta", "gamma"]);
  });

  it("sorts by type then name", () => {
    const result = sortChannels(channels, "type");
    expect(result.map((c) => c.name)).toEqual(["alpha", "gamma", "beta", "dm-bot"]);
  });

  it("does not mutate original array", () => {
    const original = [...channels];
    sortChannels(channels, "name");
    expect(channels.map((c) => c.name)).toEqual(original.map((c) => c.name));
  });

  it("handles empty array", () => {
    expect(sortChannels([], "name")).toEqual([]);
  });
});
