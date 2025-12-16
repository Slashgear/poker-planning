import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoom } from "./useRoom";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("createRoom", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("creates a room successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: "ABC123" }),
    });

    const result = await createRoom();

    // The function uses import.meta.env.DEV which is evaluated at runtime
    // In tests, it will use localhost because we're in a dev environment
    expect(mockFetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/rooms$/), {
      method: "POST",
      credentials: "include",
    });
    expect(result).toEqual({ code: "ABC123" });
  });

  it("returns error when request fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await createRoom();

    expect(result).toEqual({ error: "Failed to create room" });
  });

  it("returns error when network fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await createRoom();

    expect(result).toEqual({ error: "Failed to connect to server" });
  });

  it("calls fetch with correct URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: "DEV123" }),
    });

    await createRoom();

    // Verify that fetch is called with some URL ending in /api/rooms
    expect(mockFetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/rooms$/), {
      method: "POST",
      credentials: "include",
    });
  });
});
