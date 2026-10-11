import { useEffect, useRef, useState } from "react";
import { db, ref, onValue } from "@/services/firebase";
import {
  bumpFirebaseGeneration,
  isFirebaseGenerationStale,
} from "./firebaseGeneration";

/** Giữ snapshot theo path — tránh bảng trống khi HMR / Vite restart cắt listener. */
const firebaseValueCache = new Map();

/**
 * Realtime listener Firebase RTDB — tự cleanup + stale-check khi path đổi.
 *
 * @param {string|null|undefined} path
 * @param {{ enabled?: boolean }} [options]
 */
export function useFirebaseValue(path, options = {}) {
  const { enabled = true } = options;
  const [data, setData] = useState(() =>
    enabled && path && firebaseValueCache.has(path)
      ? firebaseValueCache.get(path)
      : undefined,
  );
  const [loading, setLoading] = useState(
    () => Boolean(enabled && path && !firebaseValueCache.has(path)),
  );
  const [error, setError] = useState(null);
  const generationRef = useRef(0);

  useEffect(() => {
    if (!enabled || !path) {
      setData(undefined);
      setLoading(false);
      setError(null);
      return undefined;
    }

    const myGeneration = bumpFirebaseGeneration(generationRef);
    const hasCache = firebaseValueCache.has(path);
    if (hasCache) {
      setData(firebaseValueCache.get(path));
      setLoading(false);
    } else {
      setLoading(true);
      setData(undefined);
    }
    setError(null);

    const dataRef = ref(db, path);
    const unsubscribe = onValue(
      dataRef,
      (snapshot) => {
        if (isFirebaseGenerationStale(myGeneration, generationRef)) return;
        const value = snapshot.val();
        firebaseValueCache.set(path, value);
        setData(value);
        setLoading(false);
      },
      (err) => {
        if (isFirebaseGenerationStale(myGeneration, generationRef)) return;
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [path, enabled]);

  return { data, loading, error };
}
