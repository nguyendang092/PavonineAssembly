import { describe, expect, it } from "vitest";
import {
  bumpFirebaseGeneration,
  isFirebaseGenerationStale,
} from "./firebaseGeneration";

describe("firebaseGeneration", () => {
  it("đánh dấu generation cũ là stale sau bump mới", () => {
    const generationRef = { current: 0 };
    const first = bumpFirebaseGeneration(generationRef);
    const second = bumpFirebaseGeneration(generationRef);

    expect(isFirebaseGenerationStale(first, generationRef)).toBe(true);
    expect(isFirebaseGenerationStale(second, generationRef)).toBe(false);
  });

  it("race condition: response cũ bị bỏ qua khi dependency đổi 2 lần liên tiếp", async () => {
    const generationRef = { current: 0 };
    const applied = [];

    async function fetchForPath(path, myGeneration) {
      const delayMs = path === "2025-08-01" ? 40 : 5;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (isFirebaseGenerationStale(myGeneration, generationRef)) return null;
      return path;
    }

    const genOld = bumpFirebaseGeneration(generationRef);
    const slowPromise = fetchForPath("2025-08-01", genOld);

    const genNew = bumpFirebaseGeneration(generationRef);
    const fastPromise = fetchForPath("2025-08-02", genNew);

    const slowResult = await slowPromise;
    const fastResult = await fastPromise;

    if (slowResult) applied.push(slowResult);
    if (fastResult) applied.push(fastResult);

    expect(slowResult).toBe(null);
    expect(fastResult).toBe("2025-08-02");
    expect(applied).toEqual(["2025-08-02"]);
  });
});
