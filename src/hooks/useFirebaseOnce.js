import { useEffect, useRef, useState } from "react";
import { db, ref, get } from "@/services/firebase";
import {
  bumpFirebaseGeneration,
  isFirebaseGenerationStale,
} from "./firebaseGeneration";

/**
 * One-shot Firebase RTDB get() — generation counter chống race khi deps đổi nhanh.
 *
 * @param {string|null|undefined} path
 * @param {unknown[]} [deps]
 */
export function useFirebaseOnce(path, deps = []) {
  const [data, setData] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const generationRef = useRef(0);

  useEffect(() => {
    if (!path) {
      setData(undefined);
      setLoading(false);
      setError(null);
      return undefined;
    }

    const myGeneration = bumpFirebaseGeneration(generationRef);
    setLoading(true);
    setError(null);
    setData(undefined);

    void get(ref(db, path))
      .then((snapshot) => {
        if (isFirebaseGenerationStale(myGeneration, generationRef)) return;
        setData(snapshot.val());
      })
      .catch((err) => {
        if (isFirebaseGenerationStale(myGeneration, generationRef)) return;
        setError(err?.message || String(err));
        setData(undefined);
      })
      .finally(() => {
        if (isFirebaseGenerationStale(myGeneration, generationRef)) return;
        setLoading(false);
      });

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps mở rộng do caller
  }, [path, ...deps]);

  return { data, loading, error };
}
