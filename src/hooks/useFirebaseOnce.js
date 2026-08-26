import { useCallback, useEffect, useRef, useState } from "react";
import { db, ref, get } from "@/services/firebase";
import {
  bumpFirebaseGeneration,
  isFirebaseGenerationStale,
} from "./firebaseGeneration";
import {
  DASHBOARD_QUERY_CACHE_TTL_MS,
  getCached,
  invalidateCached,
  setCached,
} from "@/utils/queryCache";

/**
 * One-shot Firebase RTDB get() — generation counter + cache SWR liên trang.
 *
 * @param {string|null|undefined} path
 * @param {unknown[]} [deps]
 * @param {{ cacheKey?: string, ttlMs?: number, skipCache?: boolean }} [options]
 */
export function useFirebaseOnce(path, deps = [], options = {}) {
  const {
    cacheKey: cacheKeyOption,
    ttlMs = DASHBOARD_QUERY_CACHE_TTL_MS,
    skipCache = false,
  } = options;

  const [data, setData] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const generationRef = useRef(0);

  const refresh = useCallback(() => {
    const key = cacheKeyOption ?? path ?? "";
    if (key) invalidateCached(key);
    setRefreshToken((token) => token + 1);
  }, [cacheKeyOption, path]);

  useEffect(() => {
    if (!path) {
      setData(undefined);
      setLoading(false);
      setError(null);
      setIsRevalidating(false);
      return undefined;
    }

    const myGeneration = bumpFirebaseGeneration(generationRef);
    const effectiveCacheKey = cacheKeyOption ?? path;
    const cached =
      !skipCache && effectiveCacheKey
        ? getCached(effectiveCacheKey, ttlMs)
        : null;

    if (cached?.data !== undefined) {
      setData(cached.data);
      setError(null);
      if (cached.isFresh) {
        setLoading(false);
        setIsRevalidating(false);
        return undefined;
      }
      setLoading(false);
      setIsRevalidating(true);
    } else {
      setLoading(true);
      setError(null);
      setIsRevalidating(false);
    }

    void get(ref(db, path))
      .then((snapshot) => {
        if (isFirebaseGenerationStale(myGeneration, generationRef)) return;
        const value = snapshot.val();
        if (effectiveCacheKey) setCached(effectiveCacheKey, value);
        setData(value);
      })
      .catch((err) => {
        if (isFirebaseGenerationStale(myGeneration, generationRef)) return;
        setError(err?.message || String(err));
        if (cached?.data === undefined) setData(undefined);
      })
      .finally(() => {
        if (!isFirebaseGenerationStale(myGeneration, generationRef)) {
          setLoading(false);
          setIsRevalidating(false);
        }
      });

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps mở rộng do caller
  }, [path, cacheKeyOption, ttlMs, skipCache, refreshToken, ...deps]);

  return { data, loading, error, isRevalidating, refresh };
}
