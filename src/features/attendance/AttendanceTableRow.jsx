import React, { memo } from "react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { ATTENDANCE_GIO_VAO_TYPE_OPTIONS } from "./attendanceGioVaoTypeOptions";

/** Ngưỡng: danh sách lớn hơn số này dùng virtual scroll (xem AttendanceList). */
export const ATTENDANCE_VIRTUAL_THRESHOLD = 300;

/** % cột — khớp `SeasonalStaffAttendance` (`SEASONAL_WIDTHS_*`) để colgroup/grid đồng bộ. */
const WIDTHS_WITH_ACTIONS = [7, 5, 5, 22, 5, 7, 5, 13, 10, 5, 10, 6];
const WIDTHS_NO_ACTIONS = [7, 5, 5, 28, 5, 6, 5, 13, 10, 6, 10];

/** Chuỗi grid-template-columns — header + hàng virtual dùng chung (tránh lệch cột so với <table> + tr absolute). */
export function getAttendanceGridTemplateColumns(showRowModalActions) {
  const widths = showRowModalActions ? WIDTHS_WITH_ACTIONS : WIDTHS_NO_ACTIONS;
  return widths.map((w) => `${w}%`).join(" ");
}

/** Cố định % cột — giữ cho tương thích; virtual dùng grid, không phụ thuộc colgroup. */
export function AttendanceTableColgroup({ showRowModalActions }) {
  const widths = showRowModalActions ? WIDTHS_WITH_ACTIONS : WIDTHS_NO_ACTIONS;
  return (
    <colgroup>
      {widths.map((w, i) => (
        <col key={i} style={{ width: `${w}%` }} />
      ))}
    </colgroup>
  );
}

function cellClsForGrid(virtual, s) {
  if (!virtual) return s;
  let out = s
    .replace(
      /hidden md:table-cell/g,
      "hidden md:flex md:items-center md:justify-center",
    )
    .replace(
      /hidden lg:table-cell/g,
      "hidden lg:flex lg:items-center lg:justify-center",
    )
    .trim();
  if (out.includes("text-left md:text-center")) {
    out = `${out} flex items-center justify-start md:justify-center`;
  } else if (/\btext-center\b/.test(out) && !out.includes("justify-")) {
    out = `${out} flex items-center justify-center`;
  } else if (!/\bflex\b/.test(out)) {
    out = `${out} flex items-center`;
  }
  return `${out} min-w-0`;
}

/** Tiêu đề dạng CSS Grid — dùng cùng template % với hàng virtual. */
export function AttendanceVirtualHeader({
  tl,
  showRowModalActions,
  gridTemplateColumns,
  canDeleteRow = true,
}) {
  return (
    <div
      role="row"
      className="sticky top-0 z-20 grid w-full border-b border-slate-200 shadow-sm dark:border-slate-600"
      style={{
        gridTemplateColumns,
        background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
      }}
    >
      <div
        role="columnheader"
        className="hidden min-w-0 items-center justify-center py-0.5 px-1 text-xs font-extrabold uppercase tracking-wide text-white md:flex md:px-2 md:py-1 md:text-sm"
      >
        {tl("stt", "STT")}
      </div>
      <div
        role="columnheader"
        className="flex min-w-0 items-center justify-center py-0.5 px-1 text-xs font-extrabold uppercase tracking-wide text-white md:px-2 md:py-1 md:text-sm"
      >
        {tl("mnv", "MNV")}
      </div>
      <div
        role="columnheader"
        className="hidden min-w-0 items-center justify-center py-0.5 px-1 text-sm font-extrabold tracking-wide text-white md:flex md:py-1 uppercase"
      >
        {tl("mvt", "MVT")}
      </div>
      <div
        role="columnheader"
        className="flex min-w-0 items-center justify-center py-0.5 px-1 text-xs font-extrabold uppercase tracking-wide text-white md:px-2 md:py-1 md:text-sm"
      >
        {tl("fullName", "Họ và tên")}
      </div>
      <div
        role="columnheader"
        className="hidden min-w-0 items-center justify-center py-0.5 px-1 text-center text-sm font-extrabold tracking-wide text-white md:flex md:py-1 uppercase"
      >
        {tl("gender", "Giới tính")}
      </div>
      <div
        role="columnheader"
        className="hidden min-w-0 items-center justify-center py-0.5 px-1 text-center uppercase text-sm font-extrabold tracking-wide text-white md:flex md:py-1"
      >
        {tl("dateOfBirth", "Ngày tháng năm sinh")}
      </div>
      <div
        role="columnheader"
        className="hidden min-w-0 items-center justify-center py-0.5 px-1 text-center uppercase text-sm font-extrabold tracking-wide text-white lg:flex lg:py-1"
      >
        {tl("departmentCode", "Mã BP")}
      </div>
      <div
        role="columnheader"
        className="hidden min-w-0 items-center justify-center py-0.5 px-1.5 text-center uppercase text-sm font-extrabold tracking-wide text-white md:flex md:py-1"
      >
        {tl("department", "Bộ phận")}
      </div>
      <div
        role="columnheader"
        className="flex min-w-0 items-center justify-center py-0.5 px-1 text-center text-xs font-extrabold uppercase tracking-wide text-white md:px-2 md:py-1 md:text-sm"
      >
        {tl("timeIn", "Thời gian vào")}
      </div>
      <div
        role="columnheader"
        className="hidden min-w-0 items-center justify-center py-0.5 px-1 text-center text-xs font-extrabold uppercase tracking-wide text-white md:flex md:px-2 md:py-1 md:text-sm"
      >
        {tl("timeOut", "Thời gian ra")}
      </div>
      <div
        role="columnheader"
        className="hidden min-w-0 items-center justify-center py-0.5 px-1 text-center text-xs font-extrabold uppercase tracking-wide text-white md:flex md:px-2 md:py-1 md:text-sm"
      >
        {tl("workShift", "Ca làm việc")}
      </div>
      {showRowModalActions && (
        <div
          role="columnheader"
          className="hidden min-w-0 items-center justify-center py-0.5 px-1 text-center text-xs font-extrabold uppercase tracking-wide text-white md:flex md:px-2 md:py-1 md:text-sm"
        >
          {canDeleteRow
            ? tl("actions", "Sửa / Xóa")
            : tl("actionsEditOnly", "Sửa")}
        </div>
      )}
    </div>
  );
}

/** Hàng tiêu đề bảng điểm danh — dùng chung 1 bảng khi không virtual. */
export function AttendanceTableThead({
  tl,
  showRowModalActions,
  stickyHeader,
  canDeleteRow = true,
}) {
  return (
    <thead
      className={
        stickyHeader
          ? "sticky top-0 z-20"
          : "border-b border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900"
      }
    >
      <tr
        style={{
          background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
        }}
      >
        <th className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
          {tl("stt", "STT")}
        </th>
        <th className="px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
          {tl("mnv", "MNV")}
        </th>
        <th className="hidden md:table-cell px-1 md:px-1.5 py-0.5 text-sm font-extrabold text-white uppercase tracking-wide text-center">
          {tl("mvt", "MVT")}
        </th>
        <th className="px-1 md:px-2 py-0.5 md:py-1 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
          {tl("fullName", "Họ và tên")}
        </th>
        <th className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-sm font-extrabold text-white uppercase tracking-wide text-center">
          {tl("gender", "Giới tính")}
        </th>
        <th className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-sm font-extrabold text-white uppercase tracking-wide text-center">
          {tl("dateOfBirth", "Ngày tháng năm sinh")}
        </th>
        <th className="hidden lg:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-sm font-extrabold text-white uppercase tracking-wide text-center">
          {tl("departmentCode", "Mã BP")}
        </th>
        <th className="hidden md:table-cell px-1.5 md:px-2 py-0.5 md:py-1 text-sm font-extrabold text-white uppercase tracking-wide text-center">
          {tl("department", "Bộ phận")}
        </th>
        <th className="px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
          {tl("timeIn", "Thời gian vào")}
        </th>
        <th className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
          {tl("timeOut", "Thời gian ra")}
        </th>
        <th className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
          {tl("workShift", "Ca làm việc")}
        </th>
        {showRowModalActions && (
          <th className="hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm font-extrabold text-white uppercase tracking-wide text-center">
            {canDeleteRow
              ? tl("actions", "Sửa / Xóa")
              : tl("actionsEditOnly", "Sửa")}
          </th>
        )}
      </tr>
    </thead>
  );
}

/**
 * Một hàng bảng điểm danh — tách để React.memo + virtual hóa chỉ mount hàng nhìn thấy.
 * Virtual: div + CSS Grid (cùng template với AttendanceVirtualHeader) — không dùng <tr> absolute.
 */
function AttendanceTableRow({
  emp,
  idx,
  virtualRow,
  showRowModalActions,
  user,
  canEdit,
  savingGioVao,
  editingGioVaoValue,
  savingCaLamViec,
  editingCaLamViecValue,
  tl,
  t,
  onGioVaoChange,
  onGioVaoSave,
  onCaLamChange,
  onCaLamSave,
  onEdit,
  onDelete,
  canDeleteRow = true,
  measureElementRef,
  gridTemplateColumns,
}) {
  const isGrid = virtualRow != null;
  const Row = isGrid ? "div" : "tr";
  const Cell = isGrid ? "div" : "td";
  const cellCls = (s) => cellClsForGrid(isGrid, s);

  const rowStyle = isGrid
    ? {
        display: "grid",
        gridTemplateColumns,
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        boxSizing: "border-box",
        height: `${virtualRow.size}px`,
        transform: `translateY(${virtualRow.start}px)`,
        alignItems: "center",
      }
    : undefined;

  return (
    <Row
      ref={measureElementRef}
      data-index={virtualRow != null ? idx : undefined}
      style={rowStyle}
      role={isGrid ? "row" : undefined}
      className={`transition-colors hover:bg-blue-200 border-b border-slate-100 dark:border-slate-700/40 ${
        idx % 2 === 0
          ? "bg-blue-100 dark:bg-slate-800"
          : "bg-white dark:bg-slate-900"
      }`}
    >
      <Cell
        role={isGrid ? "cell" : undefined}
        className={cellCls(
          "hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm text-center font-bold text-gray-700",
        )}
      >
        {emp.stt || idx + 1}
      </Cell>
      <Cell
        role={isGrid ? "cell" : undefined}
        className={cellCls(
          "px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm text-center font-bold text-blue-600 whitespace-nowrap",
        )}
      >
        {emp.mnv}
      </Cell>
      <Cell
        role={isGrid ? "cell" : undefined}
        className={cellCls(
          "hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-sm text-center font-semibold text-gray-700",
        )}
      >
        {emp.mvt}
      </Cell>
      <Cell
        role={isGrid ? "cell" : undefined}
        className={cellCls(
          "px-1 md:px-2 py-0.5 md:py-1 text-xs md:text-sm text-left md:text-center font-bold text-gray-800 break-words whitespace-normal leading-tight",
        )}
      >
        {emp.hoVaTen}
      </Cell>
      <Cell
        role={isGrid ? "cell" : undefined}
        className={cellCls(
          "hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-sm text-center",
        )}
      >
        <span
          className={`inline-flex items-center justify-center px-1 py-px text-[10px] font-bold leading-none rounded-full ${
            emp.gioiTinh === "YES"
              ? "bg-pink-100 text-pink-700"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          {emp.gioiTinh}
        </span>
      </Cell>
      <Cell
        role={isGrid ? "cell" : undefined}
        className={cellCls(
          "hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-sm text-center font-semibold text-gray-700",
        )}
      >
        {emp.ngayThangNamSinh}
      </Cell>
      <Cell
        role={isGrid ? "cell" : undefined}
        className={cellCls(
          "hidden lg:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-sm text-center font-bold text-gray-700",
        )}
      >
        {emp.maBoPhan}
      </Cell>
      <Cell
        role={isGrid ? "cell" : undefined}
        className={cellCls(
          "hidden md:table-cell px-1.5 md:px-2 py-0.5 md:py-1 text-sm text-center font-semibold text-gray-700",
        )}
      >
        {emp.boPhan}
      </Cell>
      <Cell
        role={isGrid ? "cell" : undefined}
        className={cellCls(
          "px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm text-center",
        )}
      >
        {emp.gioVao ? (
          <span
            className={`font-bold text-sm md:text-base ${
              /^\d{1,2}:\d{2}$/.test(emp.gioVao)
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {emp.gioVao}
          </span>
        ) : canEdit ? (
          <div className="flex items-center justify-center gap-2">
            <select
              disabled={savingGioVao}
              className="border rounded px-1.5 py-0.5 text-xs md:text-sm text-red-700 font-bold focus:ring-2 focus:ring-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
              value={editingGioVaoValue || ""}
              onChange={(e) => onGioVaoChange(emp.id, e.target.value)}
            >
              <option value="">{tl("chooseType", "Chọn loại")}</option>
              {ATTENDANCE_GIO_VAO_TYPE_OPTIONS.map(
                ({ value, shortLabel }) => (
                  <option key={value} value={value}>
                    {shortLabel}
                  </option>
                ),
              )}
            </select>
            {editingGioVaoValue && (
              <button
                type="button"
                disabled={savingGioVao}
                onClick={() => onGioVaoSave(emp.id, editingGioVaoValue)}
                className="px-1.5 py-0.5 bg-green-500 text-white rounded text-xs hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingGioVao ? (
                  <LoadingSpinner
                    size="xs"
                    className="inline-block text-white"
                  />
                ) : (
                  "✓"
                )}
              </button>
            )}
          </div>
        ) : user ? (
          <span className="text-gray-400 italic text-xs">
            🔒 {tl("cannotEdit", "Không được phép chỉnh sửa")}
          </span>
        ) : (
          <span className="text-gray-400 italic">--</span>
        )}
      </Cell>
      <Cell
        role={isGrid ? "cell" : undefined}
        className={cellCls(
          "hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm text-center min-w-0",
        )}
      >
        <span className="text-red-600 font-bold text-base">{emp.gioRa}</span>
      </Cell>
      <Cell
        role={isGrid ? "cell" : undefined}
        className={cellCls(
          "hidden md:table-cell px-1 md:px-1.5 py-0.5 md:py-1 text-xs md:text-sm text-center min-w-0",
        )}
      >
        {emp.caLamViec ? (
          <span className="text-blue-600 font-bold text-base">
            {emp.caLamViec}
          </span>
        ) : canEdit ? (
          <div className="flex items-center justify-center gap-2">
            <select
              disabled={savingCaLamViec}
              className="border rounded px-1.5 py-0.5 text-xs md:text-sm text-blue-700 font-bold focus:ring-2 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
              value={editingCaLamViecValue || ""}
              onChange={(e) => onCaLamChange(emp.id, e.target.value)}
            >
              <option value="">{tl("chooseShift", "Chọn ca")}</option>
              <option value="Ca đêm">Ca đêm</option>
              <option value="Ca 1">Ca 1</option>
              <option value="Ca 2">Ca 2</option>
              <option value="Ca hành chính">Ca hành chính</option>
            </select>
            {editingCaLamViecValue && (
              <button
                type="button"
                disabled={savingCaLamViec}
                onClick={() => onCaLamSave(emp.id, editingCaLamViecValue)}
                className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingCaLamViec ? (
                  <LoadingSpinner
                    size="xs"
                    className="inline-block text-white"
                  />
                ) : (
                  "✓"
                )}
              </button>
            )}
          </div>
        ) : user ? (
          <span className="text-gray-400 italic text-xs">
            🔒 {tl("cannotEdit", "Không được phép chỉnh sửa")}
          </span>
        ) : (
          <span className="text-gray-400 italic">--</span>
        )}
      </Cell>
      {showRowModalActions && (
        <Cell
          role={isGrid ? "cell" : undefined}
          className={cellCls("hidden md:table-cell px-1 text-center min-w-0")}
        >
          {canEdit ? (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => onEdit(emp)}
                className="px-2 py-1 bg-blue-500 text-white rounded-md text-xs font-medium hover:bg-blue-600 transition-all shadow-sm hover:shadow-md"
                title="Chỉnh sửa"
              >
                ✏️
              </button>
              {canDeleteRow ? (
                <button
                  type="button"
                  onClick={() => onDelete(emp.id)}
                  className="px-2 py-1 bg-red-500 text-white rounded-md text-xs font-medium hover:bg-red-600 transition-all shadow-sm hover:shadow-md"
                  title="Xóa"
                >
                  🗑️
                </button>
              ) : null}
            </div>
          ) : (
            <span className="text-gray-300 text-xs">—</span>
          )}
        </Cell>
      )}
    </Row>
  );
}

function propsAreEqual(prev, next) {
  if (prev.virtualRow !== next.virtualRow) {
    if (!prev.virtualRow || !next.virtualRow) return false;
    if (
      prev.virtualRow.key !== next.virtualRow.key ||
      prev.virtualRow.index !== next.virtualRow.index ||
      prev.virtualRow.start !== next.virtualRow.start ||
      prev.virtualRow.size !== next.virtualRow.size
    ) {
      return false;
    }
  }
  return (
    prev.emp === next.emp &&
    prev.idx === next.idx &&
    prev.showRowModalActions === next.showRowModalActions &&
    prev.user === next.user &&
    prev.canEdit === next.canEdit &&
    prev.savingGioVao === next.savingGioVao &&
    prev.editingGioVaoValue === next.editingGioVaoValue &&
    prev.savingCaLamViec === next.savingCaLamViec &&
    prev.editingCaLamViecValue === next.editingCaLamViecValue &&
    prev.tl === next.tl &&
    prev.t === next.t &&
    prev.onGioVaoChange === next.onGioVaoChange &&
    prev.onGioVaoSave === next.onGioVaoSave &&
    prev.onCaLamChange === next.onCaLamChange &&
    prev.onCaLamSave === next.onCaLamSave &&
    prev.onEdit === next.onEdit &&
    prev.onDelete === next.onDelete &&
    prev.canDeleteRow === next.canDeleteRow &&
    prev.measureElementRef === next.measureElementRef &&
    prev.gridTemplateColumns === next.gridTemplateColumns
  );
}

export default memo(AttendanceTableRow, propsAreEqual);
