import { describe, expect, it } from "vitest";
import { normalizeWarehouseFxRates } from "./normalizeWarehouseFxRates";

describe("normalizeWarehouseFxRates", () => {
  it("keeps finite numbers keyed by month", () => {
    expect(
      normalizeWarehouseFxRates({
        "2026-03": 18.5,
        "2026-04": "19,2",
        skip: "x",
      }),
    ).toEqual({
      "2026-03": 18.5,
      "2026-04": 19.2,
    });
  });
});
