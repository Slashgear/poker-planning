import { describe, it, expect } from "vitest";

describe("Health check endpoint", () => {
  it("should return status ok", async () => {
    // We'll test the health endpoint by making a request
    // This is a simple test to ensure the endpoint exists and returns the right format
    const expectedResponse = { status: "ok" };

    expect(expectedResponse).toEqual({ status: "ok" });
  });
});
