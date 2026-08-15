import { describe, expect, it } from "vitest";
import {
  formatS90dMonthDisplayLabel,
  listCurrentMonthDateKeys,
  listMonthDateKeys,
  listMonthKeysFromStore,
} from "./s90dDateUtils";

describe("s90dDateUtils", () => {
  it("lists days from start of month through reference date only", () => {
    const keys = listCurrentMonthDateKeys(new Date(2026, 6, 15));
    expect(keys).toHaveLength(15);
    expect(keys[0]).toBe("2026-07-01");
    expect(keys[14]).toBe("2026-07-15");
  });

  it("lists full past month days", () => {
    const keys = listMonthDateKeys("2026-06", new Date(2026, 6, 15));
    expect(keys).toHaveLength(30);
    expect(keys[0]).toBe("2026-06-01");
    expect(keys[29]).toBe("2026-06-30");
  });

  it("builds month options from stored date keys", () => {
    const options = listMonthKeysFromStore(
      {
        "2026-05-10": {},
        "2026-07-01": {},
      },
      new Date(2026, 6, 8),
    );

    expect(options).toEqual(["2026-07", "2026-05"]);
  });

  it("formats month label for dropdown", () => {
    expect(formatS90dMonthDisplayLabel("2026-07")).toBe("07/2026");
  });
});
