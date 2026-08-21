import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { db, onValue, ref, set, update } from "@/services/firebase";
import {
  formatS90dMonthDisplayLabel,
  formatS90dMonthLabel,
  listMonthDateKeys,
  listMonthKeysFromStore,
} from "../s90d/lib/s90dDateUtils";
import {
  buildGrandTotalSummaryFromManual,
  buildMonthDailySummariesFromManual,
} from "../s90d/lib/buildS90dFromManual";
import { manualEntryConfigFromReportConfig } from "../s90d/lib/s90dManualEntryReportConfig";
import {
  getProcessEntry,
  mergeProcessMonthIntoStore,
  normalizeManualStore,
  processDayHasData,
} from "../s90d/lib/s90dManualEntries";
import {
  exportS90dManualMonthToExcel,
  mergeImportedRowsIntoStore,
  readS90dManualExcelFile,
} from "../s90d/lib/s90dManualExcel";
import {
  buildManualEntriesFirebasePatch,
  parseManualEntriesSnapshot,
  patchHasManualEntryChanges,
  serializeManualEntriesForFirebase,
} from "./manualEntriesFirebase";
import { scheduleManualStorePersist } from "./manualEntriesStorage";

function loadManualStore(storageKey, manualEntryConfig) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    return normalizeManualStore(JSON.parse(raw), manualEntryConfig);
  } catch {
    return {};
  }
}

export function useProductionManualEntries(config) {
  const {
    firebaseRoot,
    storageKey,
    excelSheetName,
    excelFilePrefix,
    defaultProductCode,
  } = config;
  const manualEntryConfig = useMemo(
    () => manualEntryConfigFromReportConfig(config),
    [config],
  );

  const monthReferenceDate = useMemo(() => new Date(), []);
  const [selectedMonthKey, setSelectedMonthKey] = useState(() =>
    formatS90dMonthLabel(new Date()),
  );
  const [store, setStore] = useState(() =>
    normalizeManualStore(
      loadManualStore(storageKey, manualEntryConfig),
      manualEntryConfig,
    ),
  );
  const storeRef = useRef(store);
  storeRef.current = store;

  const [processSyncRevision, setProcessSyncRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncError, setSyncError] = useState("");
  const lastPersistedJsonRef = useRef(JSON.stringify(store));
  const skipRemoteRef = useRef(false);

  const applyLoadedStore = useCallback(
    (nextStore, { bumpProcessSync = true } = {}) => {
      const normalized = normalizeManualStore(nextStore, manualEntryConfig);
      const nextJson = JSON.stringify(normalized);

      if (nextJson === lastPersistedJsonRef.current) {
        setLoading(false);
        return;
      }

      lastPersistedJsonRef.current = nextJson;
      storeRef.current = normalized;
      setStore(normalized);

      if (bumpProcessSync) {
        setProcessSyncRevision((value) => value + 1);
      }

      scheduleManualStorePersist(storageKey, normalized);
    },
    [manualEntryConfig, storageKey],
  );

  useEffect(() => {
    const recordsRef = ref(db, firebaseRoot);
    const unsubscribe = onValue(
      recordsRef,
      (snapshot) => {
        if (skipRemoteRef.current) {
          skipRemoteRef.current = false;
          setLoading(false);
          return;
        }

        const remoteStore = normalizeManualStore(
          parseManualEntriesSnapshot(snapshot.val()),
          manualEntryConfig,
        );
        const hasRemote = Object.keys(remoteStore).length > 0;
        const localStore = normalizeManualStore(
          loadManualStore(storageKey, manualEntryConfig),
          manualEntryConfig,
        );
        const hasLocal = Object.keys(localStore).length > 0;

        let nextStore = remoteStore;
        if (!hasRemote && hasLocal) {
          nextStore = localStore;
          skipRemoteRef.current = true;
          set(ref(db, firebaseRoot), {
            ...serializeManualEntriesForFirebase(localStore),
          }).catch(() => {
            setSyncError("Không đồng bộ được dữ liệu lên Firebase.");
          });
        }

        applyLoadedStore(nextStore);
        setLoading(false);
        setSyncError("");
      },
      () => {
        applyLoadedStore(loadManualStore(storageKey, manualEntryConfig));
        setLoading(false);
        setSyncError("Không tải được dữ liệu từ Firebase — dùng bản cục bộ.");
      },
    );

    return () => unsubscribe();
  }, [applyLoadedStore, firebaseRoot, manualEntryConfig, storageKey]);

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

  const persistStore = useCallback(
    async (nextStore, { touchedDateKeys = null, fullRemoteWrite = false } = {}) => {
      const previousStore = storeRef.current;
      const normalized = normalizeManualStore(nextStore, manualEntryConfig);
      const nextJson = JSON.stringify(normalized);

      setSaving(true);
      setSyncError("");

      try {
        lastPersistedJsonRef.current = nextJson;
        storeRef.current = normalized;
        setStore(normalized);
        scheduleManualStorePersist(storageKey, normalized);

        skipRemoteRef.current = true;

        if (fullRemoteWrite || !touchedDateKeys?.length) {
          await set(ref(db, firebaseRoot), {
            ...serializeManualEntriesForFirebase(normalized),
          });
          return;
        }

        const patch = buildManualEntriesFirebasePatch(
          normalized,
          previousStore,
          touchedDateKeys,
        );

        if (patchHasManualEntryChanges(patch)) {
          await update(ref(db, firebaseRoot), patch);
        }
      } catch {
        setSyncError("Không lưu được lên Firebase — dữ liệu vẫn ở trình duyệt.");
        throw new Error("SAVE_FAILED");
      } finally {
        setSaving(false);
      }
    },
    [firebaseRoot, manualEntryConfig, storageKey],
  );

  const saveProcessMonth = useCallback(
    async (process, dateKeys, localByDate) => {
      const nextStore = mergeProcessMonthIntoStore(
        storeRef.current,
        dateKeys,
        process,
        localByDate,
        manualEntryConfig,
      );

      const touchedDateKeys = dateKeys.filter((dateKey) => {
        const localDay = localByDate[dateKey];
        if (localDay !== undefined) return true;
        return (
          JSON.stringify(nextStore[dateKey]) !==
          JSON.stringify(storeRef.current[dateKey])
        );
      });

      await persistStore(nextStore, {
        touchedDateKeys: touchedDateKeys.length ? touchedDateKeys : dateKeys,
      });
    },
    [manualEntryConfig, persistStore],
  );

  const exportMonthToExcel = useCallback(
    (processFilter = null) => {
      exportS90dManualMonthToExcel({
        store: storeRef.current,
        monthDayKeys,
        monthKey: selectedMonthKey,
        processFilter,
        sheetName: excelSheetName,
        filePrefix: excelFilePrefix,
      });
    },
    [monthDayKeys, selectedMonthKey, excelSheetName, excelFilePrefix],
  );

  const importMonthFromExcel = useCallback(
    async (file) => {
      setImporting(true);
      setSyncError("");
      try {
        const rows = await readS90dManualExcelFile(file, {
          preferredSheetName: excelSheetName,
        });
        if (!rows.length) {
          throw new Error("EMPTY_IMPORT");
        }
        const nextStore = mergeImportedRowsIntoStore(
          storeRef.current,
          rows,
          manualEntryConfig,
        );
        await persistStore(nextStore, { fullRemoteWrite: true });
        setProcessSyncRevision((value) => value + 1);
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
    [excelSheetName, manualEntryConfig, persistStore],
  );

  const getProcessEntryForDate = useCallback(
    (dateKey, process) =>
      getProcessEntry(storeRef.current, dateKey, process, manualEntryConfig),
    [manualEntryConfig],
  );

  const deferredStore = useDeferredValue(store);

  const monthDailySummaries = useMemo(
    () =>
      buildMonthDailySummariesFromManual({
        store: deferredStore,
        dateKeys: monthDayKeys,
        defaultProductCode,
        manualEntryConfig,
      }),
    [defaultProductCode, manualEntryConfig, monthDayKeys, deferredStore],
  );

  const grandTotalSummary = useMemo(
    () =>
      buildGrandTotalSummaryFromManual(
        monthDailySummaries,
        defaultProductCode,
        manualEntryConfig,
      ),
    [defaultProductCode, manualEntryConfig, monthDailySummaries],
  );

  const hasAnyData = useMemo(
    () =>
      Object.values(store ?? {}).some((day) =>
        manualEntryConfig.processes.some((process) =>
          processDayHasData(day?.[process], process, manualEntryConfig),
        ),
      ),
    [manualEntryConfig, store],
  );

  return {
    loading,
    saving,
    importing,
    syncError,
    processSyncRevision,
    saveProcessMonth,
    exportMonthToExcel,
    importMonthFromExcel,
    getProcessEntry: getProcessEntryForDate,
    firebasePath: firebaseRoot,
    monthLabel,
    monthDisplayLabel,
    monthOptions,
    selectedMonthKey,
    setSelectedMonthKey,
    monthDayKeys,
    monthDailySummaries,
    grandTotalSummary,
    hasAnyData,
    processes: manualEntryConfig.processes,
    manualEntryConfig,
  };
}
