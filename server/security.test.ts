import { describe, it, expect, vi } from "vitest";
import { isValidVote, isValidName, isValidRoomCode, securityHeaders } from "./security.js";
import type { Context } from "hono";

describe("isValidVote", () => {
  it("accepts valid Fibonacci values", () => {
    expect(isValidVote(1)).toBe(true);
    expect(isValidVote(2)).toBe(true);
    expect(isValidVote(3)).toBe(true);
    expect(isValidVote(5)).toBe(true);
    expect(isValidVote(8)).toBe(true);
    expect(isValidVote(13)).toBe(true);
    expect(isValidVote(21)).toBe(true);
    expect(isValidVote(34)).toBe(true);
    expect(isValidVote(55)).toBe(true);
    expect(isValidVote(89)).toBe(true);
  });

  it("accepts special values", () => {
    expect(isValidVote("?")).toBe(true);
    expect(isValidVote("☕")).toBe(true);
  });

  it("accepts null (no vote)", () => {
    expect(isValidVote(null)).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isValidVote(0)).toBe(false);
    expect(isValidVote(4)).toBe(false);
    expect(isValidVote(100)).toBe(false);
    expect(isValidVote("invalid")).toBe(false);
    expect(isValidVote(undefined)).toBe(false);
    expect(isValidVote({})).toBe(false);
  });
});

describe("isValidName", () => {
  it("accepts valid names", () => {
    expect(isValidName("Alice")).toBe(true);
    expect(isValidName("A")).toBe(true);
    expect(isValidName("a".repeat(50))).toBe(true);
  });

  it("rejects empty names", () => {
    expect(isValidName("")).toBe(false);
  });

  it("rejects names over 50 characters", () => {
    expect(isValidName("a".repeat(51))).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isValidName(null)).toBe(false);
    expect(isValidName(undefined)).toBe(false);
    expect(isValidName(123)).toBe(false);
    expect(isValidName({})).toBe(false);
  });
});

describe("isValidRoomCode", () => {
  it("accepts valid 6-character alphanumeric codes", () => {
    expect(isValidRoomCode("ABCDEF")).toBe(true);
    expect(isValidRoomCode("123456")).toBe(true);
    expect(isValidRoomCode("ABC123")).toBe(true);
  });

  it("rejects codes with wrong length", () => {
    expect(isValidRoomCode("ABCDE")).toBe(false);
    expect(isValidRoomCode("ABCDEFG")).toBe(false);
    expect(isValidRoomCode("")).toBe(false);
  });

  it("rejects lowercase codes", () => {
    expect(isValidRoomCode("abcdef")).toBe(false);
  });

  it("rejects codes with special characters", () => {
    expect(isValidRoomCode("ABC-EF")).toBe(false);
    expect(isValidRoomCode("ABC EF")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isValidRoomCode(null)).toBe(false);
    expect(isValidRoomCode(undefined)).toBe(false);
    expect(isValidRoomCode(123456)).toBe(false);
  });
});

describe("securityHeaders", () => {
  it("skips CSP header for /api/docs path", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const headers = new Map<string, string>();
    const mockContext = {
      req: {
        path: "/api/docs",
      },
      header: (key: string, value: string) => {
        headers.set(key, value);
      },
    } as unknown as Context;

    const mockNext = vi.fn(async () => {});

    await securityHeaders(mockContext, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(headers.has("Content-Security-Policy")).toBe(false);
    expect(headers.has("X-Frame-Options")).toBe(true);

    process.env.NODE_ENV = originalEnv;
  });

  it("applies CSP header for other paths in production", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const headers = new Map<string, string>();
    const mockContext = {
      req: {
        path: "/api/rooms",
      },
      header: (key: string, value: string) => {
        headers.set(key, value);
      },
    } as unknown as Context;

    const mockNext = vi.fn(async () => {});

    await securityHeaders(mockContext, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(headers.has("Content-Security-Policy")).toBe(true);
    expect(headers.get("Content-Security-Policy")).toContain("default-src");

    process.env.NODE_ENV = originalEnv;
  });

  it("does not apply CSP in non-production environment", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const headers = new Map<string, string>();
    const mockContext = {
      req: {
        path: "/api/rooms",
      },
      header: (key: string, value: string) => {
        headers.set(key, value);
      },
    } as unknown as Context;

    const mockNext = vi.fn(async () => {});

    await securityHeaders(mockContext, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(headers.has("Content-Security-Policy")).toBe(false);
    expect(headers.has("X-Frame-Options")).toBe(true);

    process.env.NODE_ENV = originalEnv;
  });
});
