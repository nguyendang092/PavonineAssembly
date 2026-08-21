import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { createManualEntriesRepository } from "./manualEntriesRepository";
import { extractMonthSlice } from "./manualEntriesMonthUtils";

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

  const repoRef = useRef(null);
  if (!repoRef.current) {
    repoRef.current = createManualEntriesRepository({
      firebaseRoot,
      storageKey,
      manualEntryConfig,
    });
  }
  const repo = repoRef.current;

  const [store, setStore] = useState(() => repo.loadLocalStore());
  const storeRef = useRef(store);
  storeRef.current = store;

  const [processSyncRevision, setProcessSyncRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const bootstrappedRef = useRef(false);

  const applyStore = useCallback(
    (nextStore, { bumpProcessSync = false, persistLocal = true } = {}) => {
      const normalized = normalizeManualStore(nextStore, manualEntryConfig);
      storeRef.current = normalized;
      setStore(normalized);
      if (bumpProcessSync) {
        setProcessSyncRevision((value) => value + 1);
      }
      if (persistLocal) {
        repo.persistLocal(normalized);
      }
      repo.rememberDayRevisions(
        normalized,
        Object.keys(normalized).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key)),
      );
    },
    [manualEntryConfig, repo],
  );

  const flushPendingWrites = useCallback(async () => {
    const result = await repo.flushPendingWrites((days) => {
      const next = { ...storeRef.current, ...days };
      applyStore(next, { bumpProcessSync: true });
      return next;
    });
    setPendingSyncCount(repo.pendingWriteCount());
    if (result.flushed > 0) {
      setSyncError("");
    }
    return result;
  }, [applyStore, repo]);

  useEffect(() => {
    repo.bindOnlineFlush(() => {
      flushPendingWrites().catch(() => {});
    });
    setPendingSyncCount(repo.pendingWriteCount());

    const handleMonthSlice = (monthKey, monthSlice) => {
      if (!Object.keys(monthSlice ?? {}).length) {
        const localSlice = extractMonthSlice(storeRef.current, monthKey);
        if (Object.keys(localSlice).length && !bootstrappedRef.current) {
          bootstrappedRef.current = true;
          repo.bootstrapLocalToRemote(storeRef.current).catch(() => {
            setSyncError("Không đồng bộ được dữ liệu lên Firebase.");
          });
        }
        setLoading(false);
        return;
      }

      const { store: merged, changed } = repo.applyMonthToStore(
        storeRef.current,
        monthKey,
        monthSlice,
      );

      if (!changed) {
        setLoading(false);
        return;
      }

      applyStore(merged, { bumpProcessSync: true });
      setLoading(false);
      setSyncError("");
    };

    repo.subscribeMonths(selectedMonthKey, handleMonthSlice);
    flushPendingWrites().catch(() => {});

    return () => {
      repo.unsubscribeMonths();
    };
  }, [applyStore, flushPendingWrites, repo, selectedMonthKey]);

  useEffect(() => () => repo.dispose(), [repo]);

  useEffect(() => {
    if (typeof window.requestIdleCallback !== "function") return undefined;
    const idleId = window.requestIdleCallback(() => {
      repo
        .lazyArchiveOldMonths(storeRef.current, monthReferenceDate)
        .then((archivedStore) => {
          if (archivedStore !== storeRef.current) {
            applyStore(archivedStore, { bumpProcessSync: false });
          }
        })
        .catch(() => {});
    });
    return () => window.cancelIdleCallback?.(idleId);
  }, [applyStore, monthReferenceDate, repo]);

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

  const monthDisplayLabel = useMemo(
    () => formatS90dMonthDisplayLabel(selectedMonthKey),
    [selectedMonthKey],
  );
  const monthDayKeys = useMemo(
    () => listMonthDateKeys(selectedMonthKey, monthReferenceDate),
    [selectedMonthKey, monthReferenceDate],
  );

  const persistStore = useCallback(
    async (
      nextStore,
      {
        touchedDateKeys = [],
        process = "",
        localByDate = {},
        fullRemoteWrite = false,
      } = {},
    ) => {
      const normalized = normalizeManualStore(nextStore, manualEntryConfig);

      setSaving(true);
      setSyncError("");

      try {
        applyStore(normalized, { bumpProcessSync: false });

        const remoteOk = await repo.persistStoreAttempt({
          store: normalized,
          touchedDateKeys,
          process,
          localByDate,
          fullRemoteWrite,
        });

        setPendingSyncCount(repo.pendingWriteCount());

        if (!remoteOk) {
          setSyncError(
            "Không lưu được lên Firebase — đã xếp hàng, sẽ thử lại khi có mạng.",
          );
          throw new Error("SAVE_FAILED");
        }

        setSyncError("");
      } finally {
        setSaving(false);
      }
    },
    [applyStore, manualEntryConfig, repo],
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
        if (localByDate[dateKey] !== undefined) return true;
        return (
          JSON.stringify(nextStore[dateKey]) !==
          JSON.stringify(storeRef.current[dateKey])
        );
      });

      await persistStore(nextStore, {
        touchedDateKeys: touchedDateKeys.length ? touchedDateKeys : dateKeys,
        process,
        localByDate,
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
        await persistStore(nextStore, {
          touchedDateKeys: Object.keys(nextStore),
          fullRemoteWrite: true,
        });
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

  const draftActions = useMemo(
    () => ({
      saveProcessDraft: (process, monthKey, draft) =>
        repo.saveProcessDraft(process, monthKey, draft),
      loadProcessDraft: (process, monthKey) =>
        repo.loadProcessDraft(process, monthKey),
      clearProcessDraft: (process, monthKey) =>
        repo.clearProcessDraft(process, monthKey),
    }),
    [repo],
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
    pendingSyncCount,
    processSyncRevision,
    saveProcessMonth,
    exportMonthToExcel,
    importMonthFromExcel,
    getProcessEntry: getProcessEntryForDate,
    ...draftActions,
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
