import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

describe("useKeyboardShortcuts", () => {
  let onVote: (value: number | string) => void;
  let onReveal: () => void;
  let onReset: () => void;

  beforeEach(() => {
    onVote = vi.fn();
    onReveal = vi.fn();
    onReset = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const fireKeyDown = (key: string, target?: HTMLElement) => {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "target", {
      value: target || document.body,
      enumerable: true,
    });
    window.dispatchEvent(event);
  };

  describe("number keys for voting", () => {
    it("should vote with Fibonacci values when pressing 1-9", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onVote,
          onReveal,
          onReset,
          canReveal: false,
          showResults: false,
        }),
      );

      const fibValues = [1, 2, 3, 5, 8, 13, 21, 34, 55];

      fibValues.forEach((_value, index) => {
        fireKeyDown((index + 1).toString());
      });

      expect(onVote).toHaveBeenCalledTimes(9);
      fibValues.forEach((value, index) => {
        expect(onVote).toHaveBeenNthCalledWith(index + 1, value);
      });
    });

    it("should not vote when results are shown", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onVote,
          onReveal,
          onReset,
          canReveal: true,
          showResults: true,
        }),
      );

      fireKeyDown("1");
      fireKeyDown("5");

      expect(onVote).not.toHaveBeenCalled();
    });

    it("should not vote when typing in an input field", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onVote,
          onReveal,
          onReset,
          canReveal: false,
          showResults: false,
        }),
      );

      const input = document.createElement("input");
      fireKeyDown("1", input);

      expect(onVote).not.toHaveBeenCalled();
    });

    it("should not vote when typing in a textarea", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onVote,
          onReveal,
          onReset,
          canReveal: false,
          showResults: false,
        }),
      );

      const textarea = document.createElement("textarea");
      fireKeyDown("1", textarea);

      expect(onVote).not.toHaveBeenCalled();
    });

    it("should handle keys beyond Fibonacci array length gracefully", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onVote,
          onReveal,
          onReset,
          canReveal: false,
          showResults: false,
        }),
      );

      // Key "9" is within range (index 8, value 55)
      fireKeyDown("9");
      expect(onVote).toHaveBeenCalledWith(55);

      vi.mocked(onVote).mockClear();

      // Key "0" is not in range (would be index -1)
      fireKeyDown("0");
      expect(onVote).not.toHaveBeenCalled();
    });
  });

  describe("reveal shortcut (V key)", () => {
    it("should reveal votes when V is pressed and canReveal is true", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onVote,
          onReveal,
          onReset,
          canReveal: true,
          showResults: false,
        }),
      );

      fireKeyDown("v");

      expect(onReveal).toHaveBeenCalledTimes(1);
    });

    it("should be case insensitive for V key", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onVote,
          onReveal,
          onReset,
          canReveal: true,
          showResults: false,
        }),
      );

      fireKeyDown("V");

      expect(onReveal).toHaveBeenCalledTimes(1);
    });

    it("should not reveal when canReveal is false", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onVote,
          onReveal,
          onReset,
          canReveal: false,
          showResults: false,
        }),
      );

      fireKeyDown("v");

      expect(onReveal).not.toHaveBeenCalled();
    });

    it("should not reveal when results are already shown", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onVote,
          onReveal,
          onReset,
          canReveal: true,
          showResults: true,
        }),
      );

      fireKeyDown("v");

      expect(onReveal).not.toHaveBeenCalled();
    });

    it("should not reveal when typing in an input field", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onVote,
          onReveal,
          onReset,
          canReveal: true,
          showResults: false,
        }),
      );

      const input = document.createElement("input");
      fireKeyDown("v", input);

      expect(onReveal).not.toHaveBeenCalled();
    });
  });

  describe("reset shortcut (R key)", () => {
    it("should reset when R is pressed", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onVote,
          onReveal,
          onReset,
          canReveal: false,
          showResults: false,
        }),
      );

      fireKeyDown("r");

      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it("should be case insensitive for R key", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onVote,
          onReveal,
          onReset,
          canReveal: false,
          showResults: false,
        }),
      );

      fireKeyDown("R");

      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it("should reset even when results are shown", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onVote,
          onReveal,
          onReset,
          canReveal: true,
          showResults: true,
        }),
      );

      fireKeyDown("r");

      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it("should not reset when typing in an input field", () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onVote,
          onReveal,
          onReset,
          canReveal: false,
          showResults: false,
        }),
      );

      const input = document.createElement("input");
      fireKeyDown("r", input);

      expect(onReset).not.toHaveBeenCalled();
    });
  });

  describe("event listener cleanup", () => {
    it("should remove event listener on unmount", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = renderHook(() =>
        useKeyboardShortcuts({
          onVote,
          onReveal,
          onReset,
          canReveal: false,
          showResults: false,
        }),
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it("should update event listener when callbacks change", () => {
      const { rerender } = renderHook((props) => useKeyboardShortcuts(props), {
        initialProps: {
          onVote,
          onReveal,
          onReset,
          canReveal: false,
          showResults: false,
        },
      });

      fireKeyDown("1");
      expect(onVote).toHaveBeenCalledWith(1);

      const newOnVote = vi.fn();
      rerender({
        onVote: newOnVote,
        onReveal,
        onReset,
        canReveal: false,
        showResults: false,
      });

      fireKeyDown("2");
      expect(newOnVote).toHaveBeenCalledWith(2);
      expect(onVote).toHaveBeenCalledTimes(1); // Only called once before rerender
    });
  });
});
