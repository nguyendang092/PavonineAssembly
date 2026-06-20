import {
  db,
  ref,
  onValue,
  query,
  orderByKey,
  startAt,
  endAt,
} from "@/services/firebase";
import { ANNUAL_LEAVE_RTDB_ROOT } from "./annualLeaveFields";

/** @typedef {{ data: object | null, ready: boolean, listeners: Set<() => void>, unsub: (() => void) | null }} LiveEntry */

/** @type {Map<string, LiveEntry>} */
const annualLeaveYearEntries = new Map();

/** @type {Map<string, LiveEntry>} */
const attendanceYearEntries = new Map();

function createEntry() {
  return {
    data: null,
    ready: false,
    listeners: new Set(),
    unsub: null,
  };
}

function notifyEntry(entry) {
  entry.listeners.forEach((listener) => listener());
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

function attendanceYearEntryKey(attendanceRootPath, year, throughDateKey = null) {
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

function attachAnnualLeaveYear(entry, year) {
  const yearRef = ref(db, `${ANNUAL_LEAVE_RTDB_ROOT}/${year}`);
  return onValue(yearRef, (snapshot) => {
    entry.data = snapshot.val();
    entry.ready = true;
    notifyEntry(entry);
  });
}

function attachAttendanceYear(
  entry,
  attendanceRootPath,
  year,
  throughDateKey = null,
) {
  return onValue(
    attendanceYearQuery(attendanceRootPath, year, throughDateKey),
    (snapshot) => {
      entry.data = snapshot.val();
      entry.ready = true;
      notifyEntry(entry);
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
      entry.unsub?.();
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
  return subscribeMapEntry(
    annualLeaveYearEntries,
    key,
    (entry) => attachAnnualLeaveYear(entry, year),
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
