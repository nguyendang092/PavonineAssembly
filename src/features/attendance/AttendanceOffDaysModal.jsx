import React, { useCallback, useEffect, useState } from "react";
import { db, ref, get, update } from "@/services/firebase";
import { mergeAttendanceDayMeta } from "@/features/attendance/attendanceDayMeta";
import { fetchOffAndHolidayDateKeysInMonth } from "@/features/attendance/attendanceMonthOffDays";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function sortDraftEntries(arr) {
  return [...arr]
    .filter((e) => e && DATE_KEY.test(e.key))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Admin/HR: đánh dấu nhiều ngày off / lễ (Firebase `attendance/{YYYY-MM-DD}/_meta`).
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
  const [addKind, setAddKind] = useState("off");
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
        const { off, holiday } = await fetchOffAndHolidayDateKeysInMonth(
          selectedDate,
        );
        if (!cancelled) {
          const entries = [
            ...off.map((k) => ({ key: k, kind: "off" })),
            ...holiday.map((k) => ({ key: k, kind: "holiday" })),
          ];
          const sorted = sortDraftEntries(entries);
          setDraft(sorted);
          setSnapshot(sorted);
        }
      } catch (err) {
        console.error("AttendanceOffDaysModal load month off/holiday days:", err);
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

  const addOrUpdateDate = useCallback((d, kind) => {
    if (!d || !DATE_KEY.test(d)) return;
    if (kind !== "off" && kind !== "holiday") return;
    setDraft((prev) => {
      const without = prev.filter((x) => x.key !== d);
      return sortDraftEntries([...without, { key: d, kind }]);
    });
  }, []);

  const removeDate = useCallback((d) => {
    setDraft((prev) => prev.filter((x) => x.key !== d));
  }, []);

  const handleSave = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const want = new Map(draft.map((e) => [e.key, e.kind]));
      const had = new Map(snapshot.map((e) => [e.key, e.kind]));
      const allKeys = new Set([...want.keys(), ...had.keys()]);
      const updates = {};
      for (const d of allKeys) {
        const w = want.get(d);
        const h = had.get(d);
        if (w === h) continue;
        const snap = await get(ref(db, `attendance/${d}/_meta`));
        let merged;
        if (!w) {
          merged = mergeAttendanceDayMeta(snap.val(), {
            isOffDay: false,
            isHolidayDay: false,
          });
        } else if (w === "off") {
          merged = mergeAttendanceDayMeta(snap.val(), {
            isOffDay: true,
            isHolidayDay: false,
          });
        } else {
          merged = mergeAttendanceDayMeta(snap.val(), {
            isOffDay: false,
            isHolidayDay: true,
          });
        }
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
            "Chọn nhiều ngày off / lễ",
          )}
        </h2>
        <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
          {tl(
            "dayOffMultiModalHint",
            "Chọn loại ngày (off hoặc lễ), thêm ngày vào danh sách rồi Lưu. Off → cột Ngày off = OFF; lễ → cột Ngày lễ = HOLIDAY (công/lương giống ngày off).",
          )}
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={addKind}
            onChange={(e) => setAddKind(e.target.value)}
            className="h-9 shrink-0 rounded-lg border border-slate-300 px-2 text-xs font-semibold dark:border-slate-600 dark:bg-slate-800"
            aria-label={tl("dayOffMultiKindLabel", "Loại ngày")}
          >
            <option value="off">{tl("dayKindOff", "Ngày off")}</option>
            <option value="holiday">{tl("dayKindHoliday", "Ngày lễ")}</option>
          </select>
          <input
            type="date"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="h-9 flex-1 min-w-[10rem] rounded-lg border border-slate-300 px-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <button
            type="button"
            onClick={() => {
              addOrUpdateDate(pick, addKind);
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
            onClick={() => addOrUpdateDate(selectedDate, addKind)}
            disabled={listLoading}
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
                "Đang tải các ngày off / lễ trong tháng…",
              )}
            </p>
          ) : draft.length === 0 ? (
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              {tl("dayOffMultiEmpty", "Chưa có ngày nào — chọn loại, thêm bằng lịch hoặc nút trên.")}
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {draft.map(({ key, kind }) => (
                <li
                  key={key}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                    kind === "holiday"
                      ? "bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100"
                      : "bg-violet-100 text-violet-900 dark:bg-violet-900/50 dark:text-violet-100"
                  }`}
                >
                  <span>{key}</span>
                  <span className="rounded bg-white/70 px-1 text-[10px] uppercase dark:bg-black/30">
                    {kind === "holiday"
                      ? tl("dayKindHolidayBadge", "Lễ")
                      : "OFF"}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeDate(key)}
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
