import { useCallback, useEffect, useRef, useState } from "react";
import { db, onValue, ref, remove, set } from "@/services/firebase";
import { MC_DEFECT_FILTER_ALL } from "../lib/constants";
import {
  buildMcDefectA3ManualEmployeesPath,
  parseMcDefectA3ManualEmployeesSnapshot,
  serializeMcDefectA3ManualEmployees,
} from "../lib/a3ManualEmployeesFirebase";

/** Danh sách nhân viên A3 thủ công — đồng bộ realtime Firebase theo tháng + bộ phận. */
export function useMcDefectA3ManualEmployees(
  reportMonth,
  reportDepartment,
  { onLoadError, onSaveError } = {},
) {
  const [manualEmployees, setManualEmployeesState] = useState([]);
  const [saving, setSaving] = useState(false);
  const activeScopePathRef = useRef("");

  const canSync =
    Boolean(reportMonth) && reportMonth !== MC_DEFECT_FILTER_ALL;

  useEffect(() => {
    if (!canSync) {
      activeScopePathRef.current = "";
      setManualEmployeesState([]);
      return undefined;
    }

    const scopePath = buildMcDefectA3ManualEmployeesPath(
      reportMonth,
      reportDepartment,
    );
    activeScopePathRef.current = scopePath;

    const recordsRef = ref(db, scopePath);
    const unsubscribe = onValue(
      recordsRef,
      (snapshot) => {
        if (activeScopePathRef.current !== scopePath) return;
        setManualEmployeesState(
          parseMcDefectA3ManualEmployeesSnapshot(snapshot.val()),
        );
      },
      () => {
        if (activeScopePathRef.current !== scopePath) return;
        onLoadError?.();
      },
    );

    return () => {
      if (activeScopePathRef.current === scopePath) {
        activeScopePathRef.current = "";
      }
      unsubscribe();
    };
  }, [canSync, onLoadError, reportDepartment, reportMonth]);

  const persistManualEmployees = useCallback(
    (entries) => {
      if (!canSync) return Promise.resolve();
      const scopePath = buildMcDefectA3ManualEmployeesPath(
        reportMonth,
        reportDepartment,
      );
      const payload = serializeMcDefectA3ManualEmployees(entries);
      setSaving(true);
      const savePromise =
        Object.keys(payload).length === 0
          ? remove(ref(db, scopePath))
          : set(ref(db, scopePath), payload);
      return savePromise
        .catch(() => {
          onSaveError?.();
        })
        .finally(() => {
          setSaving(false);
        });
    },
    [canSync, onSaveError, reportDepartment, reportMonth],
  );

  const setManualEmployees = useCallback(
    (updater) => {
      setManualEmployeesState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        persistManualEmployees(next);
        return next;
      });
    },
    [persistManualEmployees],
  );

  return {
    manualEmployees,
    setManualEmployees,
    saving,
  };
}
