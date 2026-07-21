import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db, onValue, ref, set } from "@/services/firebase";
import {
  formatS90dMonthDisplayLabel,
  formatS90dMonthLabel,
  listMonthDateKeys,
  listMonthKeysFromStore,
} from "../lib/s90dDateUtils";
import {
  buildGrandTotalSummaryFromManual,
  buildMonthDailySummariesFromManual,
} from "../lib/buildS90dFromManual";
import {
  parseS90dManualEntriesSnapshot,
  S90D_MANUAL_ENTRIES_FIREBASE_ROOT,
  serializeS90dManualEntriesForFirebase,
} from "../lib/s90dManualEntriesFirebase";
import { S90D_PROCESSES } from "../lib/s90dDefectColumns";
import {
  getProcessEntry,
  loadManualStore,
  mergeProcessMonthIntoStore,
  normalizeManualStore,
  processDayHasData,
  saveManualStore,
} from "../lib/s90dManualEntries";
import {
  exportS90dManualMonthToExcel,
  readS90dManualExcelFile,
  mergeImportedRowsIntoStore,
} from "../lib/s90dManualExcel";

// Tránh lỗi HMR "Rendered fewer hooks than expected" khi sửa custom hook.
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot.invalidate();
  });
}

export function useS90dManualEntries() {
  const monthReferenceDate = useMemo(() => new Date(), []);
  const [selectedMonthKey, setSelectedMonthKey] = useState(() =>
    formatS90dMonthLabel(new Date()),
  );
  const [store, setStore] = useState(() => normalizeManualStore(loadManualStore()));
  const [storeRevision, setStoreRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncError, setSyncError] = useState("");
  const lastPersistedJsonRef = useRef(JSON.stringify(store));
  const skipRemoteRef = useRef(false);

  const applyLoadedStore = useCallback((nextStore) => {
    const normalized = normalizeManualStore(nextStore);
    lastPersistedJsonRef.current = JSON.stringify(normalized);
    setStore(normalized);
    setStoreRevision((value) => value + 1);
    saveManualStore(normalized);
  }, []);

  useEffect(() => {
    const recordsRef = ref(db, S90D_MANUAL_ENTRIES_FIREBASE_ROOT);
    const unsubscribe = onValue(
      recordsRef,
      (snapshot) => {
        if (skipRemoteRef.current) {
          skipRemoteRef.current = false;
          setLoading(false);
          return;
        }

        const remoteStore = parseS90dManualEntriesSnapshot(snapshot.val());
        const hasRemote = Object.keys(remoteStore).length > 0;
        const localStore = normalizeManualStore(loadManualStore());
        const hasLocal = Object.keys(localStore).length > 0;

        let nextStore = remoteStore;
        if (!hasRemote && hasLocal) {
          nextStore = localStore;
          skipRemoteRef.current = true;
          set(ref(db, S90D_MANUAL_ENTRIES_FIREBASE_ROOT), {
            ...serializeS90dManualEntriesForFirebase(localStore),
          }).catch(() => {
            setSyncError("Không đồng bộ được dữ liệu lên Firebase.");
          });
        }

        applyLoadedStore(nextStore);
        setLoading(false);
        setSyncError("");
      },
      () => {
        applyLoadedStore(loadManualStore());
        setLoading(false);
        setSyncError("Không tải được dữ liệu từ Firebase — dùng bản cục bộ.");
      },
    );

    return () => unsubscribe();
  }, [applyLoadedStore]);

  const monthOptions = useMemo(
    () => listMonthKeysFromStore(store, monthReferenceDate),
    [store, monthReferenceDate],
  );

  useEffect(() => {
    if (!monthOptions.includes(selectedMonthKey)) {
      setSelectedMonthKey(
        monthOptions[0] ?? formatS90dMonthLabel(monthReferenceDate),
      );
    }
  }, [monthOptions, selectedMonthKey, monthReferenceDate]);

  const monthLabel = selectedMonthKey;
  const monthDisplayLabel = useMemo(
    () => formatS90dMonthDisplayLabel(selectedMonthKey),
    [selectedMonthKey],
  );
  const monthDayKeys = useMemo(
    () => listMonthDateKeys(selectedMonthKey, monthReferenceDate),
    [selectedMonthKey, monthReferenceDate],
  );

  const persistStore = useCallback(async (nextStore) => {
    const normalized = normalizeManualStore(nextStore);
    setSaving(true);
    setSyncError("");

    try {
      lastPersistedJsonRef.current = JSON.stringify(normalized);
      setStore(normalized);
      setStoreRevision((value) => value + 1);
      saveManualStore(normalized);

      skipRemoteRef.current = true;
      await set(ref(db, S90D_MANUAL_ENTRIES_FIREBASE_ROOT), {
        ...serializeS90dManualEntriesForFirebase(normalized),
      });
    } catch {
      setSyncError("Không lưu được lên Firebase — dữ liệu vẫn ở trình duyệt.");
      throw new Error("SAVE_FAILED");
    } finally {
      setSaving(false);
    }
  }, []);

  const saveProcessMonth = useCallback(
    async (process, dateKeys, localByDate) => {
      const nextStore = mergeProcessMonthIntoStore(
        store,
        dateKeys,
        process,
        localByDate,
      );
      await persistStore(nextStore);
    },
    [persistStore, store],
  );

  const exportMonthToExcel = useCallback(
    (processFilter = null) => {
      exportS90dManualMonthToExcel({
        store,
        monthDayKeys,
        monthKey: selectedMonthKey,
        processFilter,
      });
    },
    [store, monthDayKeys, selectedMonthKey],
  );

  const importMonthFromExcel = useCallback(
    async (file) => {
      setImporting(true);
      setSyncError("");
      try {
        const rows = await readS90dManualExcelFile(file);
        if (!rows.length) {
          throw new Error("EMPTY_IMPORT");
        }
        const nextStore = mergeImportedRowsIntoStore(store, rows);
        await persistStore(nextStore);
        return { importedCount: rows.length };
      } catch (error) {
        if (String(error?.message) === "EMPTY_IMPORT") {
          throw new Error("EMPTY_IMPORT");
        }
        throw new Error("IMPORT_FAILED");
      } finally {
        setImporting(false);
      }
    },
    [persistStore, store],
  );

  const getProcessEntryForDate = useCallback(
    (dateKey, process) => getProcessEntry(store, dateKey, process),
    [store],
  );

  const monthDailySummaries = useMemo(
    () =>
      buildMonthDailySummariesFromManual({
        store,
        dateKeys: monthDayKeys,
      }),
    [store, monthDayKeys],
  );

  const grandTotalSummary = useMemo(
    () => buildGrandTotalSummaryFromManual(monthDailySummaries),
    [monthDailySummaries],
  );

  const hasAnyData = useMemo(
    () =>
      Object.values(store ?? {}).some((day) =>
        S90D_PROCESSES.some((process) => processDayHasData(day?.[process])),
      ),
    [store],
  );

  return {
    loading,
    saving,
    importing,
    syncError,
    storeRevision,
    saveProcessMonth,
    exportMonthToExcel,
    importMonthFromExcel,
    getProcessEntry: getProcessEntryForDate,
    firebasePath: S90D_MANUAL_ENTRIES_FIREBASE_ROOT,
    monthLabel,
    monthDisplayLabel,
    monthOptions,
    selectedMonthKey,
    setSelectedMonthKey,
    monthDayKeys,
    monthDailySummaries,
    grandTotalSummary,
    hasAnyData,
    processes: S90D_PROCESSES,
  };
}
