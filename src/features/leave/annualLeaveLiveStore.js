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

function attendanceYearQuery(attendanceRootPath, year) {
  const y = String(year);
  return query(
    ref(db, attendanceRootPath),
    orderByKey(),
    startAt(`${y}-01-01`),
    endAt(`${y}-12-31\uf8ff`),
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

function attachAttendanceYear(entry, attendanceRootPath, year) {
  return onValue(attendanceYearQuery(attendanceRootPath, year), (snapshot) => {
    entry.data = snapshot.val();
    entry.ready = true;
    notifyEntry(entry);
  });
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
export function getAttendanceYearSnapshot(attendanceRootPath, year) {
  const entry = attendanceYearEntries.get(`${attendanceRootPath}:${year}`);
  return entry?.ready ? entry.data : null;
}

export function isAttendanceYearSnapshotReady(attendanceRootPath, year) {
  const entry = attendanceYearEntries.get(`${attendanceRootPath}:${year}`);
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
export function subscribeAttendanceYear(attendanceRootPath, year, onChange) {
  const key = `${attendanceRootPath}:${year}`;
  return subscribeMapEntry(
    attendanceYearEntries,
    key,
    (entry) => attachAttendanceYear(entry, attendanceRootPath, year),
    onChange,
  );
}
