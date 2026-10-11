import { afterEach, describe, expect, it, vi } from "vitest";
import { clearToasts, dismissToast, showToast, subscribeToasts } from "./toast";

describe("toast store", () => {
  afterEach(() => {
    clearToasts();
    vi.useRealTimers();
  });

  it("pushes success/error/warning and auto-dismisses", () => {
    vi.useFakeTimers();
    let latest = [];
    const stop = subscribeToasts((items) => {
      latest = items;
    });
    showToast({ type: "success", message: "Đã lưu", duration: 1000 });
    expect(latest).toHaveLength(1);
    expect(latest[0].type).toBe("success");
    vi.advanceTimersByTime(1000);
    expect(latest).toHaveLength(0);
    stop();
  });

  it("dedupes identical toasts in a short window", () => {
    let latest = [];
    const stop = subscribeToasts((items) => {
      latest = items;
    });
    showToast({ type: "error", message: "Lỗi", duration: 0 });
    showToast({ type: "error", message: "Lỗi", duration: 0 });
    expect(latest).toHaveLength(1);
    dismissToast(latest[0].id);
    stop();
  });

  it("refreshes an existing toast instead of stacking the same message", () => {
    vi.useFakeTimers();
    let latest = [];
    const stop = subscribeToasts((items) => {
      latest = items;
    });
    const first = showToast({ type: "success", message: "Đã lưu", duration: 1000 });
    const second = showToast({ type: "success", message: "Đã lưu", duration: 1000 });
    expect(second).toBe(first);
    expect(latest).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(latest).toHaveLength(0);
    stop();
  });
});
