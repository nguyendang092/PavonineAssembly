import { db, ref, get } from "@/services/firebase";
import { buildPayrollMonthDayChunkFromRaw } from "@/features/payroll/buildPayrollDayFromRaw";
import {
  PAYROLL_MONTH_FETCH_BATCH_SIZE,
  PAYROLL_MONTH_FETCH_YIELD_MS,
} from "@/features/payroll/payrollMonthDataScale";

export function parsePayrollMonthSortableStt(raw) {
  const n = Number(raw);
  if (Number.isFinite(n)) return n;
  const m = String(raw ?? "").match(/-?\d+(\.\d+)?/);
  if (!m) return Number.POSITIVE_INFINITY;
  const parsed = Number(m[0]);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function collectPayrollMonthSortedEmployeeIds(dayChunks) {
  const meta = new Map();
  for (const chunk of dayChunks) {
    for (const emp of chunk.employees) {
      const id = emp.monthEmployeeKey || emp.id;
      const stt = parsePayrollMonthSortableStt(emp.stt);
      const prev = meta.get(id);
      if (!prev) {
        meta.set(id, {
          sttMin: stt,
          boPhan: String(emp.boPhan ?? ""),
          ngayVaoLam: String(emp.ngayVaoLam ?? "").trim(),
        });
      } else {
        meta.set(id, {
          sttMin: Math.min(prev.sttMin, stt),
          boPhan: prev.boPhan || String(emp.boPhan ?? ""),
          ngayVaoLam: prev.ngayVaoLam || String(emp.ngayVaoLam ?? "").trim(),
        });
      }
    }
  }
  return [...meta.keys()];
}

export function payrollMonthRepresentativeEmployee(dayChunks, id) {
  let out = null;
  for (const ch of dayChunks) {
    const e = (ch.byMonthEmployeeKey || ch.byId).get(id);
    if (!e) continue;
    if (!out) out = { ...e };
    else {
      out = {
        ...out,
        hoVaTen: out.hoVaTen || e.hoVaTen,
        boPhan: out.boPhan || e.boPhan,
        mnv: out.mnv || e.mnv,
        mvt: out.mvt || e.mvt,
        maBoPhan: out.maBoPhan || e.maBoPhan,
        ngayVaoLam: out.ngayVaoLam || e.ngayVaoLam,
        ngayHopDong: out.ngayHopDong || e.ngayHopDong,
        stt: out.stt != null && String(out.stt).trim() !== "" ? out.stt : e.stt,
      };
    }
  }
  return out;
}

export function matchesPayrollMonthRowFilter(
  emp,
  { searchTerm, departmentFilter, normalizeDepartment },
) {
  const empDeptKey = normalizeDepartment(emp.boPhan);
  const departmentFilterKey = normalizeDepartment(departmentFilter);
  if (departmentFilterKey && empDeptKey !== departmentFilterKey) return false;
  const q = searchTerm.trim().toLowerCase();
  if (!q) return true;
  return (
    (emp.hoVaTen || "").toLowerCase().includes(q) ||
    (emp.mnv || "").toLowerCase().includes(q) ||
    (emp.boPhan || "").toLowerCase().includes(q)
  );
}

export function formatPayrollMonthWeekday3(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
}

/**
 * Tải dữ liệu `attendance/{ngày}` cho cả tháng — batch 4 ngày/lần.
 * @param {string[]} monthKeys
 * @param {{ onFirstBatch?: (chunks: object[]) => void, onProgress?: (chunks: object[]) => void, isStale?: () => boolean }} hooks
 */
export async function fetchPayrollMonthDayChunks(monthKeys, hooks = {}) {
  const allChunks = [];
  const batchSize =
    hooks.batchSize ?? PAYROLL_MONTH_FETCH_BATCH_SIZE;
  const yieldMs = hooks.yieldMs ?? PAYROLL_MONTH_FETCH_YIELD_MS;

  for (let i = 0; i < monthKeys.length; i += batchSize) {
    if (hooks.isStale?.()) return null;
    const batchKeys = monthKeys.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batchKeys.map(async (dateKey) => {
        const snap = await get(ref(db, `attendance/${dateKey}`));
        return buildPayrollMonthDayChunkFromRaw(snap.val(), dateKey);
      }),
    );
    if (hooks.isStale?.()) return null;
    const validBatch = batchResults.filter(Boolean);
    allChunks.push(...validBatch);
    if (hooks.onAfterBatch) {
      hooks.onAfterBatch(i, monthKeys.length, [...allChunks]);
    }
    if (i === 0 && hooks.onFirstBatch) hooks.onFirstBatch([...allChunks]);
    if (yieldMs > 0 || i + batchSize < monthKeys.length) {
      await new Promise((r) => setTimeout(r, yieldMs));
    }
  }
  return allChunks;
}
