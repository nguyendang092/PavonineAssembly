import React, { memo } from "react";
import { getAttendanceGridColumnStart } from "./gridLayout";

function AttendanceVirtualHeader({
  tl,
  showRowModalActions,
  gridTemplateColumns,
  canDeleteRow = true,
  columnPlan = "full",
  tableVariant = "attendance",
}) {
  const isPayroll = tableVariant === "payroll";
  const gcs = (key) =>
    getAttendanceGridColumnStart(
      key,
      columnPlan,
      showRowModalActions,
      tableVariant,
    );

  if (columnPlan === "minimal") {
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
          style={{ gridColumnStart: gcs("mnv") }}
          className="flex min-w-0 items-center justify-center py-px px-0.5 text-[9px] font-extrabold uppercase leading-tight tracking-normal text-white md:px-2 md:py-0.5 md:text-xs"
        >
          {tl("mnv", "MNV")}
        </div>
        <div
          role="columnheader"
          style={{ gridColumnStart: gcs("fullName") }}
          className="flex min-w-0 items-center justify-center py-px px-0.5 text-[9px] font-extrabold uppercase leading-tight tracking-normal text-white md:px-2 md:py-0.5 md:text-xs"
        >
          {tl("fullName", "Họ và tên")}
        </div>
        <div
          role="columnheader"
          style={{ gridColumnStart: gcs("timeIn") }}
          className="flex min-w-0 items-center justify-center py-px px-0.5 text-center text-[9px] font-extrabold uppercase leading-tight tracking-normal text-white md:px-2 md:py-0.5 md:text-xs"
        >
          {tl("timeIn", "Thời gian vào")}
        </div>
        <div
          role="columnheader"
          style={{ gridColumnStart: gcs("leaveType") }}
          className="flex min-w-0 items-center justify-center py-px px-0.5 text-center text-[9px] font-extrabold uppercase leading-tight tracking-normal text-white md:px-2 md:py-0.5 md:text-xs"
          title={tl(
            "leaveTypeColumnHint",
            "Loại phép / trạng thái (PN, …) — tách khỏi giờ vào.",
          )}
        >
          {tl("leaveTypeColumn", "Loại phép")}
        </div>
        <div
          role="columnheader"
          style={{ gridColumnStart: gcs("shift") }}
          className="flex min-w-0 items-center justify-center py-px px-0.5 text-center text-[9px] font-extrabold uppercase leading-tight tracking-normal text-white md:px-2 md:py-0.5 md:text-xs"
        >
          {tl("workShift", "Ca làm việc")}
        </div>
        {!isPayroll ? (
          <>
            <div
              role="columnheader"
              style={{ gridColumnStart: gcs("offDay") }}
              className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "offDayColumnHint",
                "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
              )}
            >
              {tl("offDayColumn", "Ngày off")}
            </div>
            <div
              role="columnheader"
              style={{ gridColumnStart: gcs("holidayDay") }}
              className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "holidayDayColumnHint",
                "Khi ngày được đánh dấu «Ngày lễ»: hiển thị HOLIDAY.",
              )}
            >
              {tl("holidayDayColumn", "Ngày lễ")}
            </div>
          </>
        ) : null}
        {isPayroll ? (
          <>
            <div
              role="columnheader"
              style={{ gridColumnStart: gcs("offDay") }}
              className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "offDayColumnHint",
                "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
              )}
            >
              {tl("offDayColumn", "Ngày off")}
            </div>
            <div
              role="columnheader"
              style={{ gridColumnStart: gcs("holidayDay") }}
              className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "holidayDayColumnHint",
                "Khi ngày được đánh dấu «Ngày lễ»: hiển thị HOLIDAY.",
              )}
            >
              {tl("holidayDayColumn", "Ngày lễ")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("workingHours"),
                background: "#facc15",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "payrollWorkingHoursHint",
                "Ngày thường: giờ công theo giờ vào–ra. Ngày «Ngày off» (Điểm danh): cột này «-»; cùng quy tắc giờ công hiển thị ở TC off.",
              )}
            >
              {tl("workingHours", "Giờ công")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("dayShiftOvertimeHours"),
                background: "#fb923c",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "dayShiftOvertimeHoursHint",
                "Ca ngày: giờ ra sau 17:30 (từ 17:00, 30 phút = 0,5h). Vào ≤ 06:40 có giấy TC → 06:00–07:40 (30 phút = 0,5h). Ca đêm: «-».",
              )}
            >
              {tl("dayShiftOvertimeHours", "TC ca ngày (×1.5)")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("offDayOvertimeHours"),
                background: "#c4b5fd",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "payrollOffDayTcHint",
                "Khi «Ngày off» và ca ngày: Giờ công BT + TC chiều/giấy gộp một ô; cột Giờ TC là «-».",
              )}
            >
              {tl("offDayOvertimeHours", "TC off")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("holidayDayWorkingHours"),
                background: "#6ee7b7",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "payrollHolidayDayWorkingHoursHint",
                "Khi cột ngày lễ là HOLIDAY thì giờ công sẽ hiển thị ở cột giờ công ngày lễ.",
              )}
            >
              {tl("holidayDayWorkingHours", "Giờ công ngày lễ")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("payrollTotalGcDay"),
                background: "#38bdf8",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "payrollTotalGcDayHint",
                "Tổng khối ngày: Giờ công + Giờ TC; ngày off/lễ ca ngày ≈ một cột TC off/GC lễ đã gộp (cột Giờ TC «-»); không gồm cột ca đêm.",
              )}
            >
              {tl("payrollTotalGcDay", "Tổng GC")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("nightShiftWorkingHours"),
                background: "#2dd4bf",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "nightShiftWorkingHoursHint",
                "Ca đêm: từ giờ vào đến mốc 05:00 (cùng ngày nếu vào trước 05:00, không thì 05:00 hôm sau), tối đa 8 giờ.",
              )}
            >
              {tl("nightShiftWorkingHours", "Giờ công ca đêm")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("nightShiftOvertimeHours"),
                background: "#e879f9",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "nightShiftOvertimeHoursHint",
                "Ca đêm: phần làm sau mốc 05:00 — cứ 30 phút = 0,5 giờ TC.",
              )}
            >
              {tl("nightShiftOvertimeHours", "TC ca đêm (×1.5)")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("nightShiftOffDayWorkingHours"),
                background: "#6ee7b7",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "nightShiftOffDayWorkingHoursHint",
                "Khi «Ngày off» và ca đêm: GC + TC ca đêm gộp (cùng quy tắc mốc 05:00 như ngày thường); cột TC ca đêm «-». Ngày không off thì trống.",
              )}
            >
              {tl("nightShiftOffDayWorkingHours", "GC ca đêm off")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("holidayNightWorkingHours"),
                background: "#a3e635",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "payrollHolidayNightWorkingHoursHint",
                "Khi «Ngày lễ» và ca đêm: GC + TC ca đêm gộp; cột TC ca đêm «-»; cột GC ca đêm «-».",
              )}
            >
              {tl("holidayNightWorkingHours", "GC ca đêm lễ")}
            </div>
            <div
              role="columnheader"
              style={{
                gridColumnStart: gcs("payrollTotalGcNight"),
                background: "#818cf8",
              }}
              className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:px-2 md:py-0.5 md:text-xs"
              title={tl(
                "payrollTotalGcNightHint",
                "Tổng khối ca đêm: GC + TC; ngày off/lễ ca đêm gộp một số (cột TC ca đêm «-»).",
              )}
            >
              {tl("payrollTotalGcNight", "Tổng GC ca đêm")}
            </div>
          </>
        ) : null}
        {showRowModalActions ? (
          <div
            role="columnheader"
            style={{ gridColumnStart: gcs("actions") }}
            className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:px-2 md:py-0.5 md:text-xs"
          >
            {canDeleteRow
              ? tl("actions", "Sửa / Xóa")
              : tl("actionsEditOnly", "Sửa")}
          </div>
        ) : null}
      </div>
    );
  }

  /** Layout full: Ngày vào làm, trạng thái LV, mã BP (+ bộ phận ở cột riêng). */
  const showJoinWorkStatusDeptBlock = columnPlan === "full";
  const showDeptColumn = columnPlan === "full" || columnPlan === "compact";

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
        style={{ gridColumnStart: gcs("stt") }}
        className="hidden min-w-0 items-center justify-center py-px px-1 text-xs font-extrabold uppercase tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
      >
        {tl("stt", "STT")}
      </div>
      <div
        role="columnheader"
        style={{ gridColumnStart: gcs("mnv") }}
        className="flex min-w-0 items-center justify-center py-px px-1 text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:px-2 md:py-0.5 md:text-xs"
      >
        {tl("mnv", "MNV")}
      </div>
      <div
        role="columnheader"
        style={{ gridColumnStart: gcs("mvt") }}
        className="hidden min-w-0 items-center justify-center py-px px-1 text-[10px] font-extrabold tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs uppercase"
      >
        {tl("mvt", "MVT")}
      </div>
      <div
        role="columnheader"
        style={{ gridColumnStart: gcs("fullName") }}
        className="flex min-w-0 items-center justify-center py-px px-1 text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:px-2 md:py-0.5 md:text-xs"
      >
        {tl("fullName", "Họ và tên")}
      </div>
      <div
        role="columnheader"
        style={{ gridColumnStart: gcs("gender") }}
        className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs uppercase"
      >
        {tl("gender", "Giới tính")}
      </div>
      {showJoinWorkStatusDeptBlock ? (
        <>
          <div
            role="columnheader"
            style={{ gridColumnStart: gcs("joinDate") }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center uppercase text-[10px] font-extrabold tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
          >
            {tl("joinDate", "Ngày vào làm")}
          </div>
          <div
            role="columnheader"
            style={{ gridColumnStart: gcs("workStatus") }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center uppercase text-[10px] font-extrabold tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
          >
            {tl("contractDateColumn", "Ngày HĐ")}
          </div>
          <div
            role="columnheader"
            style={{ gridColumnStart: gcs("deptCode") }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center uppercase text-[10px] font-extrabold tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
          >
            {tl("departmentCode", "Mã BP")}
          </div>
        </>
      ) : null}
      {showDeptColumn ? (
        <div
          role="columnheader"
          style={{ gridColumnStart: gcs("dept") }}
          className="hidden min-w-0 items-center justify-center py-px px-1.5 text-center uppercase text-[10px] font-extrabold tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
        >
          {tl("department", "Bộ phận")}
        </div>
      ) : null}
      <div
        role="columnheader"
        style={{ gridColumnStart: gcs("timeIn") }}
        className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:px-2 md:py-0.5 md:text-xs"
      >
        {tl("timeIn", "Thời gian vào")}
      </div>
      <div
        role="columnheader"
        style={{ gridColumnStart: gcs("timeOut") }}
        className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
      >
        {tl("timeOut", "Thời gian ra")}
      </div>
      <div
        role="columnheader"
        style={{ gridColumnStart: gcs("leaveType") }}
        className="flex min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:px-2 md:py-0.5 md:text-xs"
        title={tl(
          "leaveTypeColumnHint",
          "Loại phép / trạng thái (PN, …) — sau giờ ra.",
        )}
      >
        {tl("leaveTypeColumn", "Loại phép")}
      </div>
      <div
        role="columnheader"
        style={{ gridColumnStart: gcs("shift") }}
        className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
      >
        {tl("workShift", "Ca làm việc")}
      </div>
      {!isPayroll ? (
        <>
          <div
            role="columnheader"
            style={{ gridColumnStart: gcs("offDay") }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "offDayColumnHint",
              "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
            )}
          >
            {tl("offDayColumn", "Ngày off")}
          </div>
          <div
            role="columnheader"
            style={{ gridColumnStart: gcs("holidayDay") }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "holidayDayColumnHint",
              "Khi ngày được đánh dấu «Ngày lễ»: hiển thị HOLIDAY.",
            )}
          >
            {tl("holidayDayColumn", "Ngày lễ")}
          </div>
        </>
      ) : null}
      {isPayroll ? (
        <>
          <div
            role="columnheader"
            style={{ gridColumnStart: gcs("offDay") }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "offDayColumnHint",
              "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
            )}
          >
            {tl("offDayColumn", "Ngày off")}
          </div>
          <div
            role="columnheader"
            style={{ gridColumnStart: gcs("holidayDay") }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "holidayDayColumnHint",
              "Khi ngày được đánh dấu «Ngày lễ»: hiển thị HOLIDAY.",
            )}
          >
            {tl("holidayDayColumn", "Ngày lễ")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("workingHours"),
              background: "#facc15",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "payrollWorkingHoursHint",
              "Ngày thường: giờ công theo giờ vào–ra. Ngày «Ngày off» (Điểm danh): cột này «-»; cùng quy tắc giờ công hiển thị ở TC off.",
            )}
          >
            {tl("workingHours", "Giờ công")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("dayShiftOvertimeHours"),
              background: "#fb923c",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "dayShiftOvertimeHoursHint",
              "Ca ngày: giờ ra sau 17:30. Ca đêm: «-» (xem TC ca đêm).",
            )}
          >
            {tl("dayShiftOvertimeHours", "TC ca ngày (×1.5)")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("offDayOvertimeHours"),
              background: "#c4b5fd",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "payrollOffDayTcHint",
              "Khi «Ngày off» và ca ngày: Giờ công BT + TC chiều/giấy gộp một ô; cột Giờ TC là «-».",
            )}
          >
            {tl("offDayOvertimeHours", "TC off")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("holidayDayWorkingHours"),
              background: "#6ee7b7",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "payrollHolidayDayWorkingHoursHint",
              "Khi «Ngày lễ» và ca ngày: Giờ công BT + TC gộp một ô; cột Giờ TC là «-».",
            )}
          >
            {tl("holidayDayWorkingHours", "Giờ công ngày lễ")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("payrollTotalGcDay"),
              background: "#38bdf8",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "payrollTotalGcDayHint",
              "Tổng khối ngày: Giờ công + Giờ TC; ngày off/lễ ca ngày ≈ một cột TC off/GC lễ đã gộp (cột Giờ TC «-»); không gồm cột ca đêm.",
            )}
          >
            {tl("payrollTotalGcDay", "Tổng GC")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("nightShiftWorkingHours"),
              background: "#2dd4bf",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "nightShiftWorkingHoursHint",
              "Ca đêm: từ giờ vào đến mốc 05:00 (cùng ngày nếu vào trước 05:00, không thì 05:00 hôm sau), tối đa 8 giờ.",
            )}
          >
            {tl("nightShiftWorkingHours", "GC ca đêm")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("nightShiftOvertimeHours"),
              background: "#e879f9",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "nightShiftOvertimeHoursHint",
              "Ca đêm: phần làm sau mốc 05:00 — cứ 30 phút = 0,5 giờ TC.",
            )}
          >
            {tl("nightShiftOvertimeHours", "TC ca đêm")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("nightShiftOffDayWorkingHours"),
              background: "#6ee7b7",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "nightShiftOffDayWorkingHoursHint",
              "Khi «Ngày off» và ca đêm: GC + TC ca đêm gộp (cùng quy tắc mốc 05:00 như ngày thường); cột TC ca đêm «-». Ngày không off thì trống.",
            )}
          >
            {tl("nightShiftOffDayWorkingHours", "GC ca đêm off")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("holidayNightWorkingHours"),
              background: "#a3e635",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "payrollHolidayNightWorkingHoursHint",
              "Khi «Ngày lễ» và ca đêm: GC + TC ca đêm gộp; cột TC ca đêm «-»; cột GC ca đêm «-».",
            )}
          >
            {tl("holidayNightWorkingHours", "Giờ công ca đêm ngày lễ (X2.7)")}
          </div>
          <div
            role="columnheader"
            style={{
              gridColumnStart: gcs("payrollTotalGcNight"),
              background: "#818cf8",
            }}
            className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-gray-900 md:flex md:px-2 md:py-0.5 md:text-xs"
            title={tl(
              "payrollTotalGcNightHint",
              "Tổng khối ca đêm: GC + TC; ngày off/lễ ca đêm gộp một số (cột TC ca đêm «-»).",
            )}
          >
            {tl("payrollTotalGcNight", "Tổng GC ca đêm")}
          </div>
        </>
      ) : null}
      {showRowModalActions ? (
        <div
          role="columnheader"
          style={{ gridColumnStart: gcs("actions") }}
          className="hidden min-w-0 items-center justify-center py-px px-1 text-center text-xs font-extrabold uppercase tracking-wide text-white md:flex md:px-2 md:py-0.5 md:text-xs"
        >
          {canDeleteRow
            ? tl("actions", "Sửa / Xóa")
            : tl("actionsEditOnly", "Sửa")}
        </div>
      ) : null}
    </div>
  );
}

export default memo(AttendanceVirtualHeader);
