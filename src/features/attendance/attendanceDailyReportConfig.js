/** Công đoạn báo cáo điểm danh ngày — khớp form Excel (압출, 프레스, …). */
import { ATTENDANCE_EMP } from "./attendanceEmployeeFields";
import { ATTENDANCE_LOAI_PHEP_OPTIONS } from "./attendanceGioVaoTypeOptions";
export const ATTENDANCE_DAILY_REPORT_PROCESSES = [
  {
    id: "extrusion",
    labelKo: "압출",
    labelEn: "EXTRUSION",
  },
  {
    id: "press",
    labelKo: "프레스",
    labelEn: "PRESS",
  },
  {
    id: "mc",
    labelKo: "정밀가공",
    labelEn: "MC",
  },
  {
    id: "hairline",
    labelKo: "헤어라인",
    labelEn: "H/L",
  },
  {
    id: "anodizing",
    labelKo: "아노다이징",
    labelEn: "ANO",
  },
  {
    id: "assembly",
    labelKo: "조립",
    labelEn: "ASSY",
  },
];

const PROCESS_MATCH_RULES = [
  { id: "extrusion", test: (s) => /EXTRU/i.test(s) || s.includes("압출") },
  {
    id: "press",
    test: (s) => s === "PRESS" || /^PRESS[\s/_-]/i.test(s) || s.includes("프레스"),
  },
  {
    id: "mc",
    test: (s) =>
      s === "MC" ||
      s === "CNC" ||
      /^MC[\s/_-]/i.test(s) ||
      s.includes("정밀가공"),
  },
  {
    id: "hairline",
    test: (s) =>
      /HAIRLINE/i.test(s) ||
      s === "H/L" ||
      s === "HL" ||
      s.includes("헤어라인"),
  },
  {
    id: "anodizing",
    test: (s) => /ANODIZ/i.test(s) || s === "ANO" || s.includes("아노다이징"),
  },
];

/** Mã ghi chú VI — cùng `shortLabel` loại phép điểm danh (PN, PO, KP, …). */
function buildDailyReportRemarkShortLabels() {
  const labels = { absent: "KP" };
  for (const opt of ATTENDANCE_LOAI_PHEP_OPTIONS) {
    const key = opt.comboStatKey;
    if (!key || key === "buGioCong" || key === "late" || key === "resignedLeave") {
      continue;
    }
    if (labels[key]) continue;
    labels[key] = opt.shortLabel;
  }
  return labels;
}

/** Nhãn ghi chú KO — khớp bảng quy đổi loại phép (연차↔PN, 병가↔PO, …). */
export const ATTENDANCE_DAILY_REPORT_REMARK_LABELS_KO = {
  annualLeave: "연차",
  halfAnnualLeave: "반차",
  sickLeave: "병가",
  noPermit: "무단",
  unpaidLeave: "무급",
  maternity: "배우자 출산으로 휴가",
  funeralLeave: "경조",
  weddingLeave: "경조",
  laborAccident: "산재",
  recuperationLeave: "몸조리",
  absent: "결근",
};

let remarkShortLabelsCache = null;

export function getDailyReportRemarkLabels(locale = "vi-VN") {
  if (String(locale ?? "").toLowerCase().startsWith("ko")) {
    return ATTENDANCE_DAILY_REPORT_REMARK_LABELS_KO;
  }
  if (!remarkShortLabelsCache) {
    remarkShortLabelsCache = buildDailyReportRemarkShortLabels();
  }
  return remarkShortLabelsCache;
}

export function normalizeDailyReportDeptToken(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/** ASSY / ASSEMBLY / ASSY_* / ASSY-* / ASSY - … */
export function matchesDailyReportAssemblyDept(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  if (raw.includes("조립")) return true;

  const norm = normalizeDailyReportDeptToken(raw);
  if (/ASSEMBLY/.test(norm)) return true;
  if (norm === "ASSY") return true;
  // ASSY, ASSY_3, ASSY-5, ASSY - LINE …
  return /^ASSY(?:$|[\s/_-])/.test(norm);
}

/** Ánh xạ `boPhan` → id công đoạn (null nếu không thuộc 6 công đoạn). */
export function resolveDailyReportProcessId(boPhan) {
  const raw = String(boPhan ?? "").trim();
  if (!raw) return null;
  if (matchesDailyReportAssemblyDept(raw)) return "assembly";

  const norm = normalizeDailyReportDeptToken(raw);
  for (const rule of PROCESS_MATCH_RULES) {
    if (rule.id === "assembly") continue;
    if (rule.test(norm) || rule.test(raw)) return rule.id;
  }
  return null;
}

/** Điểm danh thời vụ hay chỉ có `maBoPhan` — thử cả mã và tên bộ phận. */
export function resolveDailyReportEmployeeProcessId(emp) {
  if (!emp || typeof emp !== "object") return null;
  const candidates = [
    emp[ATTENDANCE_EMP.DEPARTMENT],
    emp[ATTENDANCE_EMP.DEPT_CODE],
    emp.boPhan,
    emp.maBoPhan,
  ];
  const seen = new Set();
  for (const raw of candidates) {
    const token = String(raw ?? "").trim();
    if (!token || seen.has(token)) continue;
    seen.add(token);
    const processId = resolveDailyReportProcessId(token);
    if (processId) return processId;
  }
  return null;
}
