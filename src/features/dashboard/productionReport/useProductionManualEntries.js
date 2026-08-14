import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db, onValue, ref, set } from "@/services/firebase";
import {  formatS90dMonthDisplayLabel,
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
  parseManualEntriesSnapshot,
  serializeManualEntriesForFirebase,
} from "./manualEntriesFirebase";

function loadManualStore(storageKey, manualEntryConfig) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    return normalizeManualStore(JSON.parse(raw), manualEntryConfig);
  } catch {
    return {};
  }
}

function saveManualStore(storageKey, store) {
  window.localStorage.setItem(storageKey, JSON.stringify(store));
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
    normalizeManualStore(loadManualStore(storageKey, manualEntryConfig), manualEntryConfig),
  );
  const [storeRevision, setStoreRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncError, setSyncError] = useState("");
  const lastPersistedJsonRef = useRef(JSON.stringify(store));
  const skipRemoteRef = useRef(false);

  const applyLoadedStore = useCallback(
    (nextStore) => {
      const normalized = normalizeManualStore(nextStore, manualEntryConfig);
      lastPersistedJsonRef.current = JSON.stringify(normalized);
      setStore(normalized);
      setStoreRevision((value) => value + 1);
      saveManualStore(storageKey, normalized);
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
    async (nextStore) => {
      const normalized = normalizeManualStore(nextStore, manualEntryConfig);
      setSaving(true);
      setSyncError("");

      try {
        lastPersistedJsonRef.current = JSON.stringify(normalized);
        setStore(normalized);
        setStoreRevision((value) => value + 1);
        saveManualStore(storageKey, normalized);

        skipRemoteRef.current = true;
        await set(ref(db, firebaseRoot), {
          ...serializeManualEntriesForFirebase(normalized),
        });
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
        store,
        dateKeys,
        process,
        localByDate,
        manualEntryConfig,
      );
      await persistStore(nextStore);
    },
    [manualEntryConfig, persistStore, store],
  );

  const exportMonthToExcel = useCallback(
    (processFilter = null) => {
      exportS90dManualMonthToExcel({
        store,
        monthDayKeys,
        monthKey: selectedMonthKey,
        processFilter,
        sheetName: excelSheetName,
        filePrefix: excelFilePrefix,
      });
    },
    [store, monthDayKeys, selectedMonthKey, excelSheetName, excelFilePrefix],
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
        const nextStore = mergeImportedRowsIntoStore(store, rows, manualEntryConfig);
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
    [excelSheetName, manualEntryConfig, persistStore, store],
  );

  const getProcessEntryForDate = useCallback(
    (dateKey, process) =>
      getProcessEntry(store, dateKey, process, manualEntryConfig),
    [manualEntryConfig, store],
  );

  const monthDailySummaries = useMemo(
    () =>
      buildMonthDailySummariesFromManual({
        store,
        dateKeys: monthDayKeys,
        defaultProductCode,
        manualEntryConfig,
      }),
    [defaultProductCode, manualEntryConfig, monthDayKeys, store],
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
    storeRevision,
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
