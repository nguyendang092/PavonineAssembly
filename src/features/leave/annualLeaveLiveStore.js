import { startTransition } from "react";
import {
  db,
  ref,
  onValue,
  query,
  orderByKey,
  startAt,
  endAt,
} from "@/services/firebase";
import {
  bumpFirebaseGeneration,
  isFirebaseGenerationStale,
} from "@/hooks/firebaseGeneration";
import { ATTENDANCE_LEAVE_AGG_ROOT } from "./attendanceLeaveAggFields";
import { ANNUAL_LEAVE_RTDB_ROOT } from "./annualLeaveFields";
import {
  annualLeaveDailySyncLockPath,
  isAnnualLeaveDailySyncLockActive,
} from "./annualLeaveDailySyncLock";

/** @typedef {{ data: object | null, ready: boolean, listeners: Set<() => void>, unsub: (() => void) | null }} LiveEntry */

/** @type {Map<string, LiveEntry>} */
const annualLeaveYearEntries = new Map();

/** @type {Map<string, LiveEntry>} */
const attendanceYearEntries = new Map();

/** @type {Map<string, LiveEntry>} */
const attendanceJoinMonthsEntries = new Map();

/** @type {Map<string, LiveEntry>} */
const leaveAggYearEntries = new Map();

/** @type {Map<string, LiveEntry>} */
const dailySyncLockEntries = new Map();

const LIVE_NOTIFY_DEBOUNCE_MS = 220;

function createEntry() {
  return {
    data: null,
    ready: false,
    listeners: new Set(),
    unsub: null,
    notifyTimer: null,
    held: false,
    generationRef: { current: 0 },
  };
}

function holdLiveEntry(entry) {
  if (!entry || entry.held) return;
  entry.held = true;
  if (entry.notifyTimer != null) {
    clearTimeout(entry.notifyTimer);
    entry.notifyTimer = null;
  }
  bumpFirebaseGeneration(entry.generationRef);
  entry.unsub?.();
  entry.unsub = null;
}

function releaseLiveEntry(entry, attach) {
  if (!entry?.held) return;
  entry.held = false;
  if (entry.listeners.size === 0) return;
  entry.unsub = attach(entry);
}

function holdHeavyYearFanout(year) {
  const key = String(year);
  holdLiveEntry(annualLeaveYearEntries.get(key));
  holdLiveEntry(leaveAggYearEntries.get(key));
}

function releaseHeavyYearFanout(year) {
  const key = String(year);
  const yearEntry = annualLeaveYearEntries.get(key);
  releaseLiveEntry(yearEntry, (entry) => attachAnnualLeaveYear(entry, year));
  const aggEntry = leaveAggYearEntries.get(key);
  releaseLiveEntry(aggEntry, (entry) => attachLeaveAggYear(entry, year));
}

function notifyEntry(entry) {
  entry.listeners.forEach((listener) => listener());
}

function scheduleNotifyEntry(entry, immediate = false) {
  if (entry.notifyTimer != null) {
    clearTimeout(entry.notifyTimer);
    entry.notifyTimer = null;
  }

  const flush = () => {
    entry.notifyTimer = null;
    startTransition(() => {
      notifyEntry(entry);
    });
  };

  if (immediate) {
    flush();
    return;
  }

  entry.notifyTimer = setTimeout(flush, LIVE_NOTIFY_DEBOUNCE_MS);
}

function attendanceScopeKey(year, throughDateKey) {
  const y = String(year);
  if (
    throughDateKey &&
    String(throughDateKey).startsWith(`${y}-`) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(throughDateKey))
  ) {
    return String(throughDateKey);
  }
  return "full";
}

function attendanceYearEntryKey(
  attendanceRootPath,
  year,
  throughDateKey = null,
) {
  return `${attendanceRootPath}:${year}:${attendanceScopeKey(year, throughDateKey)}`;
}

function attendanceYearQuery(attendanceRootPath, year, throughDateKey = null) {
  const y = String(year);
  const scope = attendanceScopeKey(year, throughDateKey);
  const endAtKey = scope === "full" ? `${y}-12-31\uf8ff` : scope;
  return query(
    ref(db, attendanceRootPath),
    orderByKey(),
    startAt(`${y}-01-01`),
    endAt(endAtKey),
  );
}

function attachLeaveAggYear(entry, year) {
  if (shouldHoldHeavyYearFanout(year)) {
    entry.held = true;
    return () => {};
  }
  const myGeneration = bumpFirebaseGeneration(entry.generationRef);
  const yearRef = ref(db, `${ATTENDANCE_LEAVE_AGG_ROOT}/${year}`);
  return onValue(yearRef, (snapshot) => {
    if (isFirebaseGenerationStale(myGeneration, entry.generationRef)) return;
    const first = !entry.ready;
    entry.data = snapshot.val();
    entry.ready = true;
    scheduleNotifyEntry(entry, first);
  });
}

function attachAnnualLeaveYear(entry, year) {
  if (shouldHoldHeavyYearFanout(year)) {
    entry.held = true;
    return () => {};
  }
  const myGeneration = bumpFirebaseGeneration(entry.generationRef);
  const yearRef = ref(db, `${ANNUAL_LEAVE_RTDB_ROOT}/${year}`);
  return onValue(yearRef, (snapshot) => {
    if (isFirebaseGenerationStale(myGeneration, entry.generationRef)) return;
    const first = !entry.ready;
    entry.data = snapshot.val();
    entry.ready = true;
    scheduleNotifyEntry(entry, first);
  });
}

function attendanceJoinMonthsEntryKey(attendanceRootPath, year, yearMonthsKey) {
  return `${attendanceRootPath}:join:${year}:${yearMonthsKey}`;
}

function attendanceJoinMonthsQuery(attendanceRootPath, range) {
  if (!range?.startAt || !range?.endAt) return null;
  return query(
    ref(db, attendanceRootPath),
    orderByKey(),
    startAt(range.startAt),
    endAt(`${range.endAt}\uf8ff`),
  );
}

function attachAttendanceJoinMonths(entry, attendanceRootPath, range) {
  const q = attendanceJoinMonthsQuery(attendanceRootPath, range);
  if (!q) {
    entry.data = {};
    entry.ready = true;
    scheduleNotifyEntry(entry, true);
    return () => {};
  }
  const myGeneration = bumpFirebaseGeneration(entry.generationRef);
  return onValue(q, (snapshot) => {
    if (isFirebaseGenerationStale(myGeneration, entry.generationRef)) return;
    const first = !entry.ready;
    entry.data = snapshot.val();
    entry.ready = true;
    scheduleNotifyEntry(entry, first);
  });
}

function shouldHoldHeavyYearFanout(year) {
  const lock = dailySyncLockEntries.get(String(year));
  return Boolean(
    lock?.ready && isAnnualLeaveDailySyncLockActive(lock.data),
  );
}

function attachDailySyncLock(entry, year) {
  const myGeneration = bumpFirebaseGeneration(entry.generationRef);
  return onValue(ref(db, annualLeaveDailySyncLockPath(year)), (snapshot) => {
    if (isFirebaseGenerationStale(myGeneration, entry.generationRef)) return;
    const first = !entry.ready;
    entry.data = snapshot.val();
    entry.ready = true;
    if (isAnnualLeaveDailySyncLockActive(entry.data)) {
      holdHeavyYearFanout(year);
    } else {
      releaseHeavyYearFanout(year);
    }
    scheduleNotifyEntry(entry, first);
  });
}

function attachAttendanceYear(
  entry,
  attendanceRootPath,
  year,
  throughDateKey = null,
) {
  const myGeneration = bumpFirebaseGeneration(entry.generationRef);
  return onValue(
    attendanceYearQuery(attendanceRootPath, year, throughDateKey),
    (snapshot) => {
      if (isFirebaseGenerationStale(myGeneration, entry.generationRef)) return;
      const first = !entry.ready;
      entry.data = snapshot.val();
      entry.ready = true;
      scheduleNotifyEntry(entry, first);
    },
  );
}

function subscribeMapEntry(map, key, attach, onChange) {
  let entry = map.get(key);
  if (!entry) {
    entry = createEntry();
    entry.unsub = attach(entry);
    map.set(key, entry);
  }

  entry.listeners.add(onChange);
  if (entry.ready) onChange();

  return () => {
    entry.listeners.delete(onChange);
    if (entry.listeners.size === 0) {
      if (entry.notifyTimer != null) {
        clearTimeout(entry.notifyTimer);
        entry.notifyTimer = null;
      }
      bumpFirebaseGeneration(entry.generationRef);
      entry.unsub?.();
      entry.held = false;
      map.delete(key);
    }
  };
}

/** @returns {object | null} */
export function getAnnualLeaveYearSnapshot(year) {
  const entry = annualLeaveYearEntries.get(String(year));
  return entry?.ready ? entry.data : null;
}

export function isAnnualLeaveYearSnapshotReady(year) {
  const entry = annualLeaveYearEntries.get(String(year));
  return entry?.ready ?? false;
}

/** @returns {object | null} */
export function getAttendanceYearSnapshot(
  attendanceRootPath,
  year,
  throughDateKey = null,
) {
  const key = attendanceYearEntryKey(attendanceRootPath, year, throughDateKey);
  const entry = attendanceYearEntries.get(key);
  return entry?.ready ? entry.data : null;
}

export function isAttendanceYearSnapshotReady(
  attendanceRootPath,
  year,
  throughDateKey = null,
) {
  const key = attendanceYearEntryKey(attendanceRootPath, year, throughDateKey);
  const entry = attendanceYearEntries.get(key);
  return entry?.ready ?? false;
}

/** @returns {() => void} */
export function subscribeAnnualLeaveYear(year, onChange) {
  const key = String(year);
  const unsubLock = subscribeAnnualLeaveDailySyncLock(year, () => {});
  const unsubYear = subscribeMapEntry(
    annualLeaveYearEntries,
    key,
    (entry) => attachAnnualLeaveYear(entry, year),
    onChange,
  );
  return () => {
    unsubYear();
    unsubLock();
  };
}

export function isAttendanceJoinMonthsSnapshotReady(
  attendanceRootPath,
  year,
  yearMonthsKey,
) {
  const key = attendanceJoinMonthsEntryKey(
    attendanceRootPath,
    year,
    yearMonthsKey,
  );
  const entry = attendanceJoinMonthsEntries.get(key);
  return entry?.ready ?? false;
}

/** @returns {object | null} */
export function getAttendanceJoinMonthsSnapshot(
  attendanceRootPath,
  year,
  yearMonthsKey,
) {
  const key = attendanceJoinMonthsEntryKey(
    attendanceRootPath,
    year,
    yearMonthsKey,
  );
  const entry = attendanceJoinMonthsEntries.get(key);
  return entry?.ready ? entry.data : null;
}

/** @returns {() => void} */
export function subscribeAttendanceJoinMonths(
  attendanceRootPath,
  year,
  yearMonthsKey,
  range,
  onChange,
) {
  const key = attendanceJoinMonthsEntryKey(
    attendanceRootPath,
    year,
    yearMonthsKey,
  );
  return subscribeMapEntry(
    attendanceJoinMonthsEntries,
    key,
    (entry) => attachAttendanceJoinMonths(entry, attendanceRootPath, range),
    onChange,
  );
}

/** @returns {() => void} */
export function subscribeAttendanceYear(
  attendanceRootPath,
  year,
  onChange,
  throughDateKey = null,
) {
  const key = attendanceYearEntryKey(attendanceRootPath, year, throughDateKey);
  return subscribeMapEntry(
    attendanceYearEntries,
    key,
    (entry) =>
      attachAttendanceYear(entry, attendanceRootPath, year, throughDateKey),
    onChange,
  );
}

/** @returns {() => void} */
export function subscribeLeaveAggYear(year, onChange) {
  const key = String(year);
  const unsubLock = subscribeAnnualLeaveDailySyncLock(year, () => {});
  const unsubAgg = subscribeMapEntry(
    leaveAggYearEntries,
    key,
    (entry) => attachLeaveAggYear(entry, year),
    onChange,
  );
  return () => {
    unsubAgg();
    unsubLock();
  };
}

export function subscribeAnnualLeaveDailySyncLock(year, onChange) {
  if (!year || !Number.isFinite(Number(year))) {
    return () => {};
  }
  return subscribeMapEntry(
    dailySyncLockEntries,
    String(year),
    (entry) => attachDailySyncLock(entry, year),
    onChange,
  );
}

export function getAnnualLeaveDailySyncLockSnapshot(year) {
  const entry = dailySyncLockEntries.get(String(year));
  return entry?.ready ? entry.data : null;
}

export function isAnnualLeaveDailySyncLockSnapshotReady(year) {
  const entry = dailySyncLockEntries.get(String(year));
  return entry?.ready ?? false;
}

export function isAnnualLeaveDailySyncLockLiveActive(year, nowMs = Date.now()) {
  return isAnnualLeaveDailySyncLockActive(
    getAnnualLeaveDailySyncLockSnapshot(year),
    nowMs,
  );
}

export function getLeaveAggYearSnapshot(year) {
  const entry = leaveAggYearEntries.get(String(year));
  return entry?.ready ? entry.data : null;
}

export function isLeaveAggYearSnapshotReady(year) {
  const entry = leaveAggYearEntries.get(String(year));
  return entry?.ready ?? false;
}
