import React, { useCallback, useEffect, useState } from "react";
import { db, ref, get, update } from "@/services/firebase";
import { mergeAttendanceDayMeta } from "@/features/attendance/attendanceDayMeta";
import { fetchOffDayDateKeysInMonth } from "@/features/attendance/attendanceMonthOffDays";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function sortDateKeys(arr) {
  return [...new Set(arr)].filter((d) => DATE_KEY.test(d)).sort();
}

/**
 * Admin/HR: đánh dấu nhiều ngày off (Firebase `attendance/{YYYY-MM-DD}/_meta.isOffDay`).
 * Gộp meta để không ghi đè `earlyOtPaperwork`.
 */
export default function AttendanceOffDaysModal({
  open,
  onClose,
  selectedDate,
  user,
  tl,
  onSaved,
}) {
  const [draft, setDraft] = useState([]);
  const [snapshot, setSnapshot] = useState([]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!selectedDate || !DATE_KEY.test(selectedDate)) {
      setDraft([]);
      setSnapshot([]);
      setPick("");
      return;
    }
    let cancelled = false;
    setListLoading(true);
    (async () => {
      try {
        const keys = await fetchOffDayDateKeysInMonth(selectedDate);
        if (!cancelled) {
          setDraft(keys);
          setSnapshot(keys);
        }
      } catch (err) {
        console.error("AttendanceOffDaysModal load month off days:", err);
        if (!cancelled) {
          setDraft([]);
          setSnapshot([]);
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    setPick("");
    return () => {
      cancelled = true;
    };
  }, [open, selectedDate]);

  const addDate = useCallback((d) => {
    if (!d || !DATE_KEY.test(d)) return;
    setDraft((prev) => sortDateKeys([...prev, d]));
  }, []);

  const removeDate = useCallback((d) => {
    setDraft((prev) => prev.filter((x) => x !== d));
  }, []);

  const handleSave = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const next = new Set(draft);
      const prev = new Set(snapshot);
      const toTrue = [...next].filter((d) => !prev.has(d));
      const toFalse = [...prev].filter((d) => !next.has(d));
      const updates = {};
      for (const d of toTrue) {
        const snap = await get(ref(db, `attendance/${d}/_meta`));
        const merged = mergeAttendanceDayMeta(snap.val(), { isOffDay: true });
        updates[`attendance/${d}/_meta`] = merged;
      }
      for (const d of toFalse) {
        const snap = await get(ref(db, `attendance/${d}/_meta`));
        const merged = mergeAttendanceDayMeta(snap.val(), { isOffDay: false });
        updates[`attendance/${d}/_meta`] = merged;
      }
      if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
      }
      onClose();
      onSaved?.();
    } catch (err) {
      console.error("AttendanceOffDaysModal save:", err);
    } finally {
      setBusy(false);
    }
  }, [user, draft, snapshot, onClose, onSaved]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="off-days-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-violet-200 bg-white p-4 shadow-xl dark:border-violet-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="off-days-modal-title"
          className="mb-2 text-base font-bold text-violet-900 dark:text-violet-100"
        >
          {tl(
            "dayOffMultiModalTitle",
            "Chọn nhiều ngày off",
          )}
        </h2>
        <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
          {tl(
            "dayOffMultiModalHint",
            "Các ngày trong danh sách được lưu là «Ngày off» (cột Ngày off = OFF, bảng lương dùng TC off). Có thể thêm hoặc bỏ ngày rồi bấm Lưu.",
          )}
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="h-9 flex-1 min-w-[10rem] rounded-lg border border-slate-300 px-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <button
            type="button"
            onClick={() => {
              addDate(pick);
              setPick("");
            }}
            disabled={!pick || !DATE_KEY.test(pick)}
            className="h-9 shrink-0 rounded-lg bg-violet-600 px-3 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40"
          >
            {tl("dayOffMultiAddDate", "Thêm")}
          </button>
        </div>
        {selectedDate && DATE_KEY.test(selectedDate) ? (
          <button
            type="button"
            onClick={() => addDate(selectedDate)}
            disabled={draft.includes(selectedDate) || listLoading}
            className="mb-3 w-full rounded-lg border border-violet-300 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-40 dark:border-violet-700 dark:text-violet-200 dark:hover:bg-violet-950/50"
          >
            {tl("dayOffMultiAddCurrent", "Thêm ngày đang xem ({{date}})", {
              date: selectedDate,
            })}
          </button>
        ) : null}
        <div className="mb-3 min-h-[3rem] rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/80">
          {listLoading ? (
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              {tl(
                "dayOffMultiLoadingList",
                "Đang tải các ngày off trong tháng…",
              )}
            </p>
          ) : draft.length === 0 ? (
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              {tl("dayOffMultiEmpty", "Chưa có ngày nào — thêm bằng lịch hoặc nút trên.")}
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {draft.map((d) => (
                <li
                  key={d}
                  className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-900 dark:bg-violet-900/50 dark:text-violet-100"
                >
                  <span className="tabular-nums">{d}</span>
                  <button
                    type="button"
                    onClick={() => removeDate(d)}
                    className="rounded-full px-1 text-violet-600 hover:bg-violet-200/80 dark:text-violet-300 dark:hover:bg-violet-800"
                    aria-label={tl("dayOffMultiRemove", "Bỏ ngày")}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {tl("dayOffMultiCancel", "Hủy")}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy || listLoading}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {busy
              ? tl("dayOffMultiSaving", "Đang lưu…")
              : tl("dayOffMultiSave", "Lưu")}
          </button>
        </div>
      </div>
    </div>
  );
}
