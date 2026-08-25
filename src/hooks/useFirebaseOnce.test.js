import { describe, expect, it } from "vitest";
import {
  bumpFirebaseGeneration,
  isFirebaseGenerationStale,
} from "./firebaseGeneration";

/**
 * Mô phỏng logic useFirebaseOnce: get() song song, chỉ generation mới nhất được apply.
 */
async function simulateUseFirebaseOnceSequence(fetchByPath) {
  const generationRef = { current: 0 };
  let latestData = undefined;

  async function runFetch(path) {
    const myGeneration = bumpFirebaseGeneration(generationRef);
    const value = await fetchByPath(path);
    if (isFirebaseGenerationStale(myGeneration, generationRef)) return;
    latestData = value;
  }

  const first = runFetch("attendance/2025-08-01");
  const second = runFetch("attendance/2025-08-02");
  await Promise.all([first, second]);
  return latestData;
}

describe("useFirebaseOnce race guard", () => {
  it("giữ dữ liệu của dependency mới nhất khi request cũ resolve sau", async () => {
    const result = await simulateUseFirebaseOnceSequence(async (path) => {
      const delayMs = path.endsWith("08-01") ? 30 : 5;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return `data:${path}`;
    });

    expect(result).toBe("data:attendance/2025-08-02");
  });
});
