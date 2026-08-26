import { describe, expect, it } from "vitest";
import {
  HR_TABLE_VIRTUAL_THRESHOLD,
  shouldHrTableVirtualize,
} from "./hrTableVirtualization.jsx";

describe("hrTableVirtualization", () => {
  it("bật virtual khi >= ngưỡng", () => {
    expect(shouldHrTableVirtualize(HR_TABLE_VIRTUAL_THRESHOLD - 1)).toBe(false);
    expect(shouldHrTableVirtualize(HR_TABLE_VIRTUAL_THRESHOLD)).toBe(true);
    expect(shouldHrTableVirtualize(500)).toBe(true);
  });
});
