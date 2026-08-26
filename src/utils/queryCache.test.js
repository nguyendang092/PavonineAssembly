import { describe, expect, it, vi, afterEach } from "vitest";
import {
  DASHBOARD_QUERY_CACHE_TTL_MS,
  getCached,
  setCached,
  invalidateCached,
  clearQueryCache,
} from "./queryCache";

describe("queryCache", () => {
  afterEach(() => {
    clearQueryCache();
    vi.restoreAllMocks();
  });

  it("getCached trả isFresh trong TTL", () => {
    setCached("k1", { rows: [1] });
    const hit = getCached("k1", DASHBOARD_QUERY_CACHE_TTL_MS);
    expect(hit?.data).toEqual({ rows: [1] });
    expect(hit?.isFresh).toBe(true);
  });

  it("invalidateCached làm entry stale nhưng vẫn trả data", () => {
    setCached("k2", "payload");
    invalidateCached("k2");
    const hit = getCached("k2", DASHBOARD_QUERY_CACHE_TTL_MS);
    expect(hit?.data).toBe("payload");
    expect(hit?.isFresh).toBe(false);
  });

  it("entry hết TTL được coi là stale", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    setCached("k3", "old");
    vi.spyOn(Date, "now").mockReturnValue(
      1_000_000 + DASHBOARD_QUERY_CACHE_TTL_MS + 1,
    );
    const hit = getCached("k3", DASHBOARD_QUERY_CACHE_TTL_MS);
    expect(hit?.data).toBe("old");
    expect(hit?.isFresh).toBe(false);
  });
});
