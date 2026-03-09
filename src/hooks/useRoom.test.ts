import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/preact";
import { createRoom, useRoom } from "./useRoom";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ─── MockEventSource ──────────────────────────────────────────────────────────

type EventHandler = (event: { data: string }) => void;

class MockEventSource {
  url: string;
  withCredentials: boolean;
  private listeners: Map<string, EventHandler[]> = new Map();
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(url: string, options?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = options?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, fn: EventHandler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(fn);
  }

  /** Helper to simulate an SSE update from the server */
  simulateUpdate(data: unknown) {
    const handlers = this.listeners.get("update") ?? [];
    handlers.forEach((fn) => fn({ data: JSON.stringify(data) }));
  }

  /** Helper to simulate a connection error */
  simulateError() {
    this.onerror?.();
  }

  static instances: MockEventSource[] = [];
  static reset() {
    MockEventSource.instances = [];
  }
}

// ─── createRoom ──────────────────────────────────────────────────────────────

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

    expect(mockFetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/rooms$/), {
      method: "POST",
      credentials: "include",
    });
  });
});

// ─── useRoom SSE reconnection ─────────────────────────────────────────────────

describe("useRoom SSE reconnection", () => {
  const roomInfoResponse = {
    code: "ABC123",
    memberCount: 1,
    currentMember: { id: "m1", name: "Alice" },
  };

  beforeEach(() => {
    MockEventSource.reset();
    mockFetch.mockClear();
    // Default: room info fetch always succeeds
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => roomInfoResponse,
    });
    // Replace global EventSource with our mock
    vi.stubGlobal("EventSource", MockEventSource);
    // Ensure document.visibilityState starts as "visible"
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("creates an EventSource on mount and fetches room info", async () => {
    const { unmount } = renderHook(() => useRoom("ABC123"));

    await act(async () => {});

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toMatch(/\/api\/rooms\/ABC123\/events/);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/rooms\/ABC123$/),
      expect.objectContaining({ credentials: "include" }),
    );

    unmount();
  });

  it("sets isConnected=true when an update event arrives", async () => {
    const { result, unmount } = renderHook(() => useRoom("ABC123"));

    await act(async () => {});

    const instance = MockEventSource.instances[0];
    act(() => {
      instance.simulateUpdate({ code: "ABC123", members: [], showResults: false });
    });

    expect(result.current.isConnected).toBe(true);

    unmount();
  });

  it("sets isConnected=false on SSE error", async () => {
    const { result, unmount } = renderHook(() => useRoom("ABC123"));

    await act(async () => {});

    // First simulate a successful update so we start connected
    act(() => {
      MockEventSource.instances[0].simulateUpdate({
        code: "ABC123",
        members: [],
        showResults: false,
      });
    });
    expect(result.current.isConnected).toBe(true);

    act(() => {
      MockEventSource.instances[0].simulateError();
    });
    expect(result.current.isConnected).toBe(false);

    unmount();
  });

  it("reconnects (new EventSource + fetchRoomInfo) when page becomes visible after being hidden", async () => {
    const { unmount } = renderHook(() => useRoom("ABC123"));

    await act(async () => {});

    expect(MockEventSource.instances).toHaveLength(1);
    const firstInstance = MockEventSource.instances[0];
    const fetchCallCount = mockFetch.mock.calls.length;

    // Simulate page going to background (no reconnect expected)
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Should not have reconnected
    expect(MockEventSource.instances).toHaveLength(1);

    // Simulate page coming back to foreground
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Old instance should be closed, new one created
    expect(firstInstance.close).toHaveBeenCalled();
    expect(MockEventSource.instances).toHaveLength(2);
    // fetchRoomInfo should have been called again
    expect(mockFetch.mock.calls.length).toBeGreaterThan(fetchCallCount);

    unmount();
  });

  it("reconnects (new EventSource + fetchRoomInfo) when network comes back online", async () => {
    const { unmount } = renderHook(() => useRoom("ABC123"));

    await act(async () => {});

    expect(MockEventSource.instances).toHaveLength(1);
    const firstInstance = MockEventSource.instances[0];
    const fetchCallCount = mockFetch.mock.calls.length;

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    expect(firstInstance.close).toHaveBeenCalled();
    expect(MockEventSource.instances).toHaveLength(2);
    expect(mockFetch.mock.calls.length).toBeGreaterThan(fetchCallCount);

    unmount();
  });

  it("closes EventSource and removes listeners on unmount", async () => {
    const docSpy = vi.spyOn(document, "removeEventListener");
    const winSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useRoom("ABC123"));

    await act(async () => {});

    const instance = MockEventSource.instances[0];
    unmount();

    expect(instance.close).toHaveBeenCalled();
    expect(docSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(winSpy).toHaveBeenCalledWith("online", expect.any(Function));

    docSpy.mockRestore();
    winSpy.mockRestore();
  });
});
