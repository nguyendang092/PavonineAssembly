import {
  db,
  get,
  off,
  onValue,
  orderByKey,
  query,
  ref,
  runTransaction,
  set,
  startAt,
  endAt,
  update,
} from "@/services/firebase";
import { normalizeManualStore } from "../s90d/lib/s90dManualEntries";
import { buildArchiveMonthPatch, applyArchiveMonthLocally } from "./manualEntriesArchive";
import {
  mergeDayEntryOnConflict,
  readDayUpdatedAt,
  stampDayUpdatedAt,
} from "./manualEntriesDayMerge";
import {
  clearProcessDraft,
  loadProcessDraft,
  saveProcessDraft,
} from "./manualEntriesDraft";
import {
  applyMonthSliceIfChanged,
  buildMonthMetaOnlyPatch,
  parseManualEntriesSnapshot,
  serializeManualEntriesForFirebase,
} from "./manualEntriesFirebase";
import {
  computeMonthChecksum,
  extractMonthSlice,
  listArchivableMonthKeys,
  monthKeyToDateRange,
  subscriptionMonthKeys,
} from "./manualEntriesMonthUtils";
import {
  dequeuePendingWrite,
  enqueuePendingWrite,
  loadPendingWrites,
  pendingWriteCount,
} from "./manualEntriesPendingQueue";
import { scheduleManualStorePersist } from "./manualEntriesStorage";

function loadLocalStoreRaw(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Data layer: Firebase + localStorage + pending queue + draft.
 * Presentation hook không gọi Firebase trực tiếp.
 */
export function createManualEntriesRepository({
  firebaseRoot,
  storageKey,
  manualEntryConfig,
}) {
  /** @type {Map<string, () => void>} */
  const monthUnsubs = new Map();
  let metaUnsub = null;
  let skipRemote = false;
  let onlineListener = null;

  /** @type {Record<string, string>} */
  const monthChecksumCache = {};
  /** @type {Record<string, number>} */
  const dayRevisionCache = {};

  function loadLocalStore() {
    return normalizeManualStore(loadLocalStoreRaw(storageKey), manualEntryConfig);
  }

  function persistLocal(store) {
    scheduleManualStorePersist(storageKey, store);
  }

  function rememberDayRevisions(store, dateKeys) {
    for (const dateKey of dateKeys) {
      dayRevisionCache[dateKey] = readDayUpdatedAt(store?.[dateKey]);
    }
  }

  function getDayRevision(dateKey) {
    return dayRevisionCache[dateKey] ?? 0;
  }

  function parseMonthSnapshot(raw, monthKey) {
    const entries = parseManualEntriesSnapshot(raw);
    return extractMonthSlice(entries, monthKey);
  }

  async function fetchMonthSlice(monthKey) {
    const { start, end } = monthKeyToDateRange(monthKey);
    const monthQuery = query(
      ref(db, firebaseRoot),
      orderByKey(),
      startAt(start),
      endAt(end),
    );
    const snapshot = await get(monthQuery);
    return parseMonthSnapshot(snapshot.val(), monthKey);
  }

  function subscribeMonth(monthKey, onMonthSlice) {
    const existing = monthUnsubs.get(monthKey);
    if (existing) existing();

    const { start, end } = monthKeyToDateRange(monthKey);
    const monthQuery = query(
      ref(db, firebaseRoot),
      orderByKey(),
      startAt(start),
      endAt(end),
    );

    const handleValue = (snapshot) => {
      if (skipRemote) return;
      const slice = parseMonthSnapshot(snapshot.val(), monthKey);
      const checksum = computeMonthChecksum(slice);
      if (monthChecksumCache[monthKey] === checksum) return;
      monthChecksumCache[monthKey] = checksum;
      onMonthSlice(monthKey, slice);
    };

    onValue(monthQuery, handleValue, () => {
      onMonthSlice(monthKey, {});
    });

    monthUnsubs.set(monthKey, () => off(monthQuery, "value", handleValue));
  }

  function subscribeMeta() {
    if (metaUnsub) metaUnsub();
    const metaRef = ref(db, `${firebaseRoot}/_meta`);
    const handleValue = (snapshot) => {
      if (skipRemote) return;
      const months = snapshot.val()?.months ?? {};
      for (const [monthKey, payload] of Object.entries(months)) {
        if (payload?.checksum) {
          monthChecksumCache[monthKey] = payload.checksum;
        }
      }
    };
    onValue(metaRef, handleValue);
    metaUnsub = () => off(metaRef, "value", handleValue);
  }

  function subscribeMonths(selectedMonthKey, onMonthSlice) {
    unsubscribeMonths();
    subscribeMeta();

    const months = subscriptionMonthKeys(selectedMonthKey);
    for (const monthKey of months) {
      subscribeMonth(monthKey, onMonthSlice);
    }

    const adjacent = months.filter((key) => key !== selectedMonthKey);
    for (const monthKey of adjacent) {
      fetchMonthSlice(monthKey)
        .then((slice) => {
          const checksum = computeMonthChecksum(slice);
          if (monthChecksumCache[monthKey] === checksum) return;
          monthChecksumCache[monthKey] = checksum;
          onMonthSlice(monthKey, slice);
        })
        .catch(() => {});
    }
  }

  function unsubscribeMonths() {
    for (const unsub of monthUnsubs.values()) unsub();
    monthUnsubs.clear();
    if (metaUnsub) {
      metaUnsub();
      metaUnsub = null;
    }
  }

  function applyMonthToStore(store, monthKey, monthSlice) {
    const sliceKeys = Object.keys(monthSlice ?? {});
    if (!sliceKeys.length) {
      return {
        store,
        changed: false,
        checksum: computeMonthChecksum({}),
      };
    }

    const incomingChecksum = computeMonthChecksum(monthSlice);
    if (monthChecksumCache[monthKey] === incomingChecksum) {
      const localSlice = extractMonthSlice(store, monthKey);
      if (computeMonthChecksum(localSlice) === incomingChecksum) {
        return { store, changed: false, checksum: incomingChecksum };
      }
    }

    return applyMonthSliceIfChanged(store, monthKey, monthSlice);
  }

  async function bootstrapLocalToRemote(localStore) {
    skipRemote = true;
    try {
      await set(ref(db, firebaseRoot), {
        ...serializeManualEntriesForFirebase(localStore),
      });
    } finally {
      skipRemote = false;
    }
  }

  async function saveDayWithTransaction(dateKey, clientDay, process, localProcessDay) {
    const dayRef = ref(db, `${firebaseRoot}/${dateKey}`);
    const baseUpdatedAt = getDayRevision(dateKey);

    await runTransaction(dayRef, (remoteDay) => {
      const remote =
        remoteDay && typeof remoteDay === "object" ? remoteDay : null;
      const remoteUpdatedAt = readDayUpdatedAt(remote);

      let mergedDay = clientDay;
      if (remote && remoteUpdatedAt > baseUpdatedAt) {
        mergedDay = mergeDayEntryOnConflict(
          remote,
          clientDay,
          process,
          localProcessDay,
        );
      } else if (remote) {
        mergedDay = { ...remote, ...clientDay };
      }

      return stampDayUpdatedAt(mergedDay);
    });
  }

  async function persistDays({
    store,
    touchedDateKeys,
    process,
    localByDate,
    fullRemoteWrite = false,
  }) {
    skipRemote = true;
    try {
      if (fullRemoteWrite) {
        await set(ref(db, firebaseRoot), {
          ...serializeManualEntriesForFirebase(store),
        });
        rememberDayRevisions(store, touchedDateKeys);
        return;
      }

      for (const dateKey of touchedDateKeys) {
        const clientDay = store?.[dateKey];
        if (!clientDay) continue;
        const localProcessDay = localByDate?.[dateKey] ?? clientDay?.[process] ?? {};
        await saveDayWithTransaction(
          dateKey,
          clientDay,
          process,
          localProcessDay,
        );
      }

      const monthKeys = [
        ...new Set(touchedDateKeys.map((dateKey) => dateKey.slice(0, 7))),
      ];
      const metaPatch = buildMonthMetaOnlyPatch(store, monthKeys);
      await update(ref(db, firebaseRoot), metaPatch);

      rememberDayRevisions(store, touchedDateKeys);
    } finally {
      skipRemote = false;
    }
  }

  async function persistStoreAttempt(options) {
    try {
      await persistDays(options);
      return true;
    } catch {
      enqueuePendingWrite(storageKey, {
        dateKeys: options.touchedDateKeys,
        days: Object.fromEntries(
          options.touchedDateKeys.map((dateKey) => [dateKey, options.store[dateKey]]),
        ),
        process: options.process ?? "",
      });
      return false;
    }
  }

  async function flushPendingWrites(mergeIntoStore) {
    const queue = loadPendingWrites(storageKey);
    if (!queue.length) return { flushed: 0, failed: 0 };

    let flushed = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        const store = mergeIntoStore(item.days);
        await persistDays({
          store,
          touchedDateKeys: item.dateKeys,
          process: item.process,
          localByDate: item.days,
          fullRemoteWrite: false,
        });
        dequeuePendingWrite(storageKey, item.id);
        flushed += 1;
      } catch {
        failed += 1;
      }
    }

    return { flushed, failed };
  }

  function bindOnlineFlush(flushFn) {
    if (onlineListener) {
      window.removeEventListener("online", onlineListener);
    }
    onlineListener = () => {
      flushFn();
    };
    window.addEventListener("online", onlineListener);
  }

  function dispose() {
    unsubscribeMonths();
    if (onlineListener) {
      window.removeEventListener("online", onlineListener);
      onlineListener = null;
    }
  }

  async function archiveMonth(store, monthKey) {
    const patch = buildArchiveMonthPatch(firebaseRoot, monthKey, store);
    skipRemote = true;
    try {
      await update(ref(db), patch);
    } finally {
      skipRemote = false;
    }
    return applyArchiveMonthLocally(store, monthKey);
  }

  async function lazyArchiveOldMonths(store, referenceDate = new Date()) {
    const monthKeys = listArchivableMonthKeys(store, referenceDate);
    let nextStore = store;
    for (const monthKey of monthKeys) {
      const slice = extractMonthSlice(nextStore, monthKey);
      if (!Object.keys(slice).length) continue;
      nextStore = await archiveMonth(nextStore, monthKey);
    }
    return nextStore;
  }

  return {
    loadLocalStore,
    persistLocal,
    subscribeMonths,
    unsubscribeMonths,
    applyMonthToStore,
    bootstrapLocalToRemote,
    persistStoreAttempt,
    flushPendingWrites,
    bindOnlineFlush,
    pendingWriteCount: () => pendingWriteCount(storageKey),
    rememberDayRevisions,
    loadProcessDraft: (process, monthKey) =>
      loadProcessDraft(storageKey, process, monthKey),
    saveProcessDraft: (process, monthKey, draft) =>
      saveProcessDraft(storageKey, process, monthKey, draft),
    clearProcessDraft: (process, monthKey) =>
      clearProcessDraft(storageKey, process, monthKey),
    lazyArchiveOldMonths,
    dispose,
  };
}
