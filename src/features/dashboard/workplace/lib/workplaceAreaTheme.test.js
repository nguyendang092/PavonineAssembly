import { describe, expect, it } from "vitest";
import {
  resolveWorkplaceAreaStatus,
  resolveWorkplaceAreaTheme,
} from "./workplaceAreaTheme";

describe("workplaceAreaTheme", () => {
  it("returns palette per production area", () => {
    expect(resolveWorkplaceAreaTheme("PRESS").accent).toBe("#2563EB");
    expect(resolveWorkplaceAreaTheme("HAIRLINE").accent).toBe("#7C3AED");
  });

  it("classifies NG status bands", () => {
    expect(resolveWorkplaceAreaStatus(2)).toBe("stable");
    expect(resolveWorkplaceAreaStatus(5)).toBe("watch");
    expect(resolveWorkplaceAreaStatus(12)).toBe("warning");
  });
});
