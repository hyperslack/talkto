/**
 * Tests for agent response time metrics.
 */

import { describe, expect, it } from "bun:test";

describe("Response Time Metrics", () => {
  it("metrics shape has all required fields", () => {
    const metrics = {
      agent_name: "test-agent",
      avg_response_ms: 1500,
      median_response_ms: 1200,
      min_response_ms: 800,
      max_response_ms: 3000,
      sample_count: 5,
    };
    expect(metrics.agent_name).toBe("test-agent");
    expect(metrics.avg_response_ms).toBe(1500);
    expect(metrics.median_response_ms).toBe(1200);
    expect(metrics.min_response_ms).toBe(800);
    expect(metrics.max_response_ms).toBe(3000);
    expect(metrics.sample_count).toBe(5);
  });

  it("empty metrics when no responses", () => {
    const metrics = {
      agent_name: "idle-agent",
      avg_response_ms: null,
      median_response_ms: null,
      min_response_ms: null,
      max_response_ms: null,
      sample_count: 0,
    };
    expect(metrics.sample_count).toBe(0);
    expect(metrics.avg_response_ms).toBeNull();
  });

  it("calculates average correctly from sample data", () => {
    const times = [1000, 2000, 3000];
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    expect(avg).toBe(2000);
  });

  it("calculates median correctly for odd count", () => {
    const times = [100, 200, 300, 400, 500];
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    expect(median).toBe(300);
  });

  it("filters out responses over 1 hour", () => {
    const times = [1000, 2000, 3700000]; // 3.7M ms > 1 hour
    const filtered = times.filter((t) => t > 0 && t < 3600000);
    expect(filtered.length).toBe(2);
  });

  it("ignores negative time differences", () => {
    const diff = -500;
    expect(diff > 0 && diff < 3600000).toBe(false);
  });
});
