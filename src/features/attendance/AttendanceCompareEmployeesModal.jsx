import React, { memo, useMemo, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { sumCompareRowsTotals } from "./attendanceCompareEmployeesLogic";
import "./attendanceCompareEmployees.css";

function formatDelta(n) {
  const v = Number(n) || 0;
  if (v > 0) return `+${v}`;
  return String(v);
}

function CompareEmployeeChips({ employees, tone }) {
  if (!employees?.length) {
    return <span className="att-compare-empty-cell">—</span>;
  }
  return (
    <div className="att-compare-chips">
      {employees.map((emp, idx) => {
        const entry =
          emp && typeof emp === "object"
            ? emp
            : { stt: null, label: String(emp ?? "") };
        const sttText =
          entry.stt === null || entry.stt === undefined || entry.stt === ""
            ? "—"
            : String(entry.stt);
        return (
          <span
            key={`${entry.label}-${sttText}-${idx}`}
            className={`att-compare-chip ${tone === "curr" ? "is-curr" : "is-prev"}`}
            title={entry.label}
          >
            <span className="att-compare-chip-stt">{sttText}</span>
            <span className="att-compare-chip-name">{entry.label}</span>
          </span>
        );
      })}
    </div>
  );
}

function AttendanceCompareEmployeesModal({
  isOpen,
  onClose,
  compareBusy,
  result,
  criteria,
  onChangeCriteria,
  onCompare,
  tl,
}) {
  const [diffOnly, setDiffOnly] = useState(true);
  const rows = result?.rows || [];
  const departments = result?.departments || [];
  const totals = useMemo(() => sumCompareRowsTotals(rows), [rows]);
  const visibleRows = useMemo(
    () => (diffOnly ? rows.filter((row) => row.hasDiff) : rows),
    [rows, diffOnly],
  );

  const handleCompareClick = useCallback(() => {
    onCompare?.(criteria);
  }, [onCompare, criteria]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="att-compare-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-compare-employees-title"
    >
      <div
        className="att-compare-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="att-compare-head">
          <div>
            <h3 id="attendance-compare-employees-title">
              {tl("compareEmployeesTitle", "So sánh nhân viên theo bộ phận")}
            </h3>
            <p className="att-compare-range">
              <span>{result?.previousDate || "—"}</span>
              <em>→</em>
              <span>{result?.currentDate || "—"}</span>
            </p>
          </div>
          <button type="button" className="att-compare-close" onClick={onClose}>
            {tl("close", "Đóng")}
          </button>
        </header>

        <div className="att-compare-toolbar">
          <label className="att-compare-field">
            {tl("compareEmployeesPickPreviousDate", "Ngày trước")}
            <input
              type="date"
              value={criteria?.previousDate || ""}
              onChange={(e) =>
                onChangeCriteria?.((prev) => ({
                  ...prev,
                  previousDate: e.target.value,
                }))
              }
            />
          </label>
          <label className="att-compare-field">
            {tl("compareEmployeesPickDate", "Chọn ngày")}
            <input
              type="date"
              value={criteria?.compareDate || ""}
              onChange={(e) =>
                onChangeCriteria?.((prev) => ({
                  ...prev,
                  compareDate: e.target.value,
                }))
              }
            />
          </label>
          <label className="att-compare-field">
            {tl("department", "Bộ phận")}
            <select
              value={criteria?.department || ""}
              onChange={(e) =>
                onChangeCriteria?.((prev) => ({
                  ...prev,
                  department: e.target.value,
                }))
              }
            >
              <option value="">
                {tl("compareEmployeesAllDepartments", "Tất cả bộ phận")}
              </option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <div className="att-compare-actions">
            <label
              className={`att-compare-filter${diffOnly ? " is-on" : ""}`}
              title={tl(
                "compareEmployeesDiffOnlyHint",
                "Bộ lọc bảng: ẩn bộ phận số lượng không đổi. Không chạy so sánh.",
              )}
            >
              <input
                type="checkbox"
                checked={diffOnly}
                onChange={(e) => setDiffOnly(e.target.checked)}
              />
              <span>
                {tl(
                  "compareEmployeesDiffOnly",
                  "Chỉ hiện bộ phận có thay đổi",
                )}
              </span>
            </label>
            <button
              type="button"
              className="att-compare-run"
              onClick={handleCompareClick}
              disabled={compareBusy}
              title={tl(
                "compareEmployeesRunHint",
                "Tải dữ liệu theo ngày đã chọn.",
              )}
            >
              {compareBusy
                ? tl("compareEmployeesLoading", "Đang so sánh...")
                : tl("compareEmployeesRun", "Chạy so sánh")}
            </button>
          </div>
        </div>

        {!compareBusy && rows.length > 0 ? (
          <div className="att-compare-kpis">
            <div className="att-compare-kpi is-slate">
              <span>{tl("compareEmployeesPrevTotal", "Ngày trước")}</span>
              <strong>{totals.previous}</strong>
            </div>
            <div className="att-compare-kpi is-sky">
              <span>{tl("compareEmployeesCurrentTotal", "Hiện tại")}</span>
              <strong>{totals.current}</strong>
            </div>
            <div className="att-compare-kpi is-emerald">
              <span>{tl("compareEmployeesSameTotal", "Trùng")}</span>
              <strong>{totals.same}</strong>
            </div>
            <div className="att-compare-kpi is-rose">
              <span>{tl("compareEmployeesOnlyPrevious", "Chỉ trước")}</span>
              <strong>{totals.previousOnly}</strong>
            </div>
            <div className="att-compare-kpi is-blue">
              <span>{tl("compareEmployeesOnlyCurrent", "Chỉ hiện tại")}</span>
              <strong>{totals.currentOnly}</strong>
            </div>
          </div>
        ) : null}

        <div className="att-compare-body">
          {compareBusy ? (
            <div className="att-compare-empty">
              <LoadingSpinner size="sm" />
              {tl("compareEmployeesLoading", "Đang so sánh dữ liệu...")}
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="att-compare-empty">
              {rows.length > 0
                ? tl(
                    "compareEmployeesNoDiff",
                    "Không có bộ phận nào thay đổi. Bỏ chọn bộ lọc để xem toàn bộ.",
                  )
                : tl(
                    "compareEmployeesNoData",
                    "Không có dữ liệu để so sánh.",
                  )}
            </div>
          ) : (
            <div className="att-compare-table-wrap">
            <table className="att-compare-table">
              <thead>
                <tr>
                  <th className="att-compare-col-dept">
                    {tl("department", "Bộ phận")}
                  </th>
                  <th className="att-compare-col-num">
                    {tl("compareEmployeesColPrev", "Trước")}
                  </th>
                  <th className="att-compare-col-num">
                    {tl("compareEmployeesColCurrent", "Hiện tại")}
                  </th>
                  <th className="att-compare-col-delta">
                    {tl("compareEmployeesDelta", "Chênh lệch")}
                  </th>
                  <th className="att-compare-col-num">
                    {tl("compareEmployeesColSame", "Trùng")}
                  </th>
                  <th className="att-compare-col-people">
                    {tl("compareEmployeesOnlyPrevious", "Chỉ ngày trước")}
                  </th>
                  <th className="att-compare-col-people">
                    {tl("compareEmployeesOnlyCurrent", "Chỉ ngày hiện tại")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const delta = Number(row.delta) || 0;
                  return (
                    <tr
                      key={row.department}
                      className={delta !== 0 ? "is-changed" : ""}
                    >
                      <td>
                        <span className="att-compare-dept">{row.department}</span>
                      </td>
                      <td className="att-compare-num">{row.previousCount}</td>
                      <td className="att-compare-num">{row.currentCount}</td>
                      <td className="att-compare-num">
                        <span
                          className={`att-compare-delta${
                            delta > 0 ? " is-up" : delta < 0 ? " is-down" : ""
                          }`}
                        >
                          {formatDelta(delta)}
                        </span>
                      </td>
                      <td className="att-compare-num">{row.sameCount}</td>
                      <td>
                        <CompareEmployeeChips
                          employees={row.previousOnly}
                          tone="prev"
                        />
                      </td>
                      <td>
                        <CompareEmployeeChips
                          employees={row.currentOnly}
                          tone="curr"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default memo(AttendanceCompareEmployeesModal);
