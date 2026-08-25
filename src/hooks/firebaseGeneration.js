/**
 * Generation counter — hủy kết quả Firebase cũ khi path/deps đổi nhanh (race condition).
 * Dùng chung cho useFirebaseValue, useFirebaseOnce và listener tùy biến.
 */

/** @param {{ current: number }} generationRef */
export function bumpFirebaseGeneration(generationRef) {
  generationRef.current += 1;
  return generationRef.current;
}

/** @param {number} myGeneration @param {{ current: number }} generationRef */
export function isFirebaseGenerationStale(myGeneration, generationRef) {
  return myGeneration !== generationRef.current;
}
