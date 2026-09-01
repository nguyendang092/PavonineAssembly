import { ANNUAL_LEAVE_EMP, ANNUAL_LEAVE_META_KEY } from "./fields.mjs";

export function attendanceMnvStorageKey(mnvRaw) {
  return String(mnvRaw ?? "")
    .trim()
    .replace(/\s+/g, "");
}

export function attendanceFirebaseKeyFromMnv(mnvNormalized) {
  const m = attendanceMnvStorageKey(mnvNormalized);
  if (!m) return "";
  const safe = m.replace(/[.#$[\]/]/g, "_");
  return `emp_${safe}`;
}

export function mnvFromEmpFirebaseKey(key) {
  const text = String(key ?? "").trim();
  if (!text.startsWith("emp_")) return "";
  return attendanceMnvStorageKey(text.slice(4)) || text.slice(4);
}

export function annualLeaveEmpFirebaseKey(mnv) {
  return attendanceFirebaseKeyFromMnv(attendanceMnvStorageKey(mnv));
}

export function attendanceMnvKeyFromDayRecord(empKey, rawEmp) {
  const fromField = attendanceMnvStorageKey(rawEmp?.mnv);
  if (fromField) return fromField;
  const fromKey = mnvFromEmpFirebaseKey(empKey);
  if (fromKey) return fromKey;
  return attendanceMnvStorageKey(empKey);
}

export function isAnnualLeaveEmpFirebaseKey(key) {
  return String(key ?? "").startsWith("emp_");
}

export function resolveAnnualLeaveEmpFirebaseKey({ recordId, raw } = {}) {
  const mnvKey = attendanceMnvStorageKey(
    raw?.[ANNUAL_LEAVE_EMP.MNV_PREFIX] ?? raw?.mnvPrefix,
  );
  if (mnvKey) {
    const fromMnv = annualLeaveEmpFirebaseKey(mnvKey);
    if (fromMnv) return fromMnv;
  }

  const id = String(recordId ?? raw?.id ?? "").trim();
  if (isAnnualLeaveEmpFirebaseKey(id)) return id;
  return "";
}

/** Gom bản ghi năm theo `emp_{mnv}`. */
export function indexAnnualLeaveYearByEmpKey(yearData) {
  const byEmpKey = {};
  if (!yearData || typeof yearData !== "object") return byEmpKey;

  for (const [recordId, raw] of Object.entries(yearData)) {
    if (recordId === ANNUAL_LEAVE_META_KEY || !raw || typeof raw !== "object") {
      continue;
    }

    const empKey = resolveAnnualLeaveEmpFirebaseKey({ recordId, raw });
    if (!empKey) continue;

    byEmpKey[empKey] = { recordId, raw, empKey };
  }

  return byEmpKey;
}
