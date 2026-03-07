import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, listChannels, normalizeError } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api error handling", () => {
  it("parses structured API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "Agent went offline",
            code: "agent_offline",
            hint: "Ask the agent to re-register.",
            retryable: true,
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(listChannels()).rejects.toMatchObject({
      name: "ApiError",
      message: "Agent went offline",
      status: 503,
      code: "agent_offline",
      hint: "Ask the agent to re-register.",
      retryable: true,
    });
  });

  it("uses detail payloads as the user-facing message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: "Cannot delete the #general channel",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(listChannels()).rejects.toMatchObject({
      name: "ApiError",
      message: "Cannot delete the #general channel",
      status: 400,
    });
  });

  it("normalizes network failures", () => {
    const error = normalizeError(new Error("socket hang up"));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.code).toBe("network_error");
    expect(error.retryable).toBe(true);
  });
});
