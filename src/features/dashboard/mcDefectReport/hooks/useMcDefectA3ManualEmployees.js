import { useCallback, useEffect, useState } from "react";
import { db, ref, remove, set } from "@/services/firebase";
import { useFirebaseValue } from "@/hooks/useFirebaseValue";
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

  const canSync =
    Boolean(reportMonth) && reportMonth !== MC_DEFECT_FILTER_ALL;
  const scopePath = canSync
    ? buildMcDefectA3ManualEmployeesPath(reportMonth, reportDepartment)
    : null;
  const { data: scopeRaw, error: scopeError } = useFirebaseValue(scopePath, {
    enabled: canSync,
  });

  useEffect(() => {
    if (!canSync) {
      setManualEmployeesState([]);
      return;
    }
    if (scopeError) {
      onLoadError?.();
      return;
    }
    setManualEmployeesState(parseMcDefectA3ManualEmployeesSnapshot(scopeRaw));
  }, [canSync, onLoadError, scopeError, scopeRaw]);

  const persistManualEmployees = useCallback(
    (entries) => {
      if (!canSync) return Promise.resolve();
      const path = buildMcDefectA3ManualEmployeesPath(
        reportMonth,
        reportDepartment,
      );
      const payload = serializeMcDefectA3ManualEmployees(entries);
      setSaving(true);
      const savePromise =
        Object.keys(payload).length === 0
          ? remove(ref(db, path))
          : set(ref(db, path), payload);
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
