import { useEffect, useRef, useState } from "react";
import { db, ref, onValue } from "@/services/firebase";
import {
  bumpFirebaseGeneration,
  isFirebaseGenerationStale,
} from "./firebaseGeneration";

/**
 * Realtime listener Firebase RTDB — tự cleanup + stale-check khi path đổi.
 *
 * @param {string|null|undefined} path
 * @param {{ enabled?: boolean }} [options]
 */
export function useFirebaseValue(path, options = {}) {
  const { enabled = true } = options;
  const [data, setData] = useState(undefined);
  const [loading, setLoading] = useState(false);
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
    setLoading(true);
    setError(null);
    setData(undefined);

    const dataRef = ref(db, path);
    const unsubscribe = onValue(
      dataRef,
      (snapshot) => {
        if (isFirebaseGenerationStale(myGeneration, generationRef)) return;
        setData(snapshot.val());
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
