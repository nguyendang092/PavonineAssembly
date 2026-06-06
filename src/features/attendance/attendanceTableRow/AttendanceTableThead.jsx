import React, { memo } from "react";
import { cellClsForAttendanceTable } from "./gridLayout";

function AttendanceTableThead({
  tl,
  showRowModalActions,
  stickyHeader,
  canDeleteRow = true,
  columnPlan = "full",
  tableVariant = "attendance",
}) {
  const isPayroll = tableVariant === "payroll";
  if (columnPlan === "minimal") {
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
          <th className="px-0.5 md:px-1.5 py-px md:py-0.5 text-[8px] md:text-xs font-extrabold text-white uppercase tracking-normal text-center leading-tight">
            {tl("mnv", "MNV")}
          </th>
          <th className="px-0.5 md:px-2 py-px md:py-0.5 text-[8px] md:text-xs font-extrabold text-white uppercase tracking-normal text-center leading-tight">
            {tl("fullName", "Họ và tên")}
          </th>
          <th className="px-0.5 md:px-1.5 py-px md:py-0.5 text-[8px] md:text-xs font-extrabold text-white uppercase tracking-normal text-center leading-tight">
            {tl("timeIn", "Thời gian vào")}
          </th>
          <th
            className="px-0.5 md:px-1.5 py-px md:py-0.5 text-[8px] md:text-xs font-extrabold text-white uppercase tracking-normal text-center leading-tight"
            title={tl(
              "leaveTypeColumnHint",
              "Loại phép / trạng thái (PN, …) — tách khỏi giờ vào.",
            )}
          >
            {tl("leaveTypeColumn", "Loại phép")}
          </th>
          <th
            className="px-0.5 md:px-1.5 py-px md:py-0.5 text-[8px] md:text-xs font-extrabold text-white uppercase tracking-normal text-center leading-tight"
            title={tl(
              "workShiftColumnHint",
              "Ca làm việc (S1 ngày / S2 đêm) — chỉnh qua nút Sửa khi được phép.",
            )}
          >
            {tl("workShift", "Ca làm việc")}
          </th>
          {!isPayroll ? (
            <>
              <th
                className="hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight"
                title={tl(
                  "offDayColumnHint",
                  "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
                )}
              >
                {tl("offDayColumn", "Ngày off")}
              </th>
              <th
                className="hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight"
                title={tl(
                  "holidayDayColumnHint",
                  "Khi ngày được đánh dấu «Ngày lễ»: hiển thị HOLIDAY.",
                )}
              >
                {tl("holidayDayColumn", "Ngày lễ")}
              </th>
            </>
          ) : null}
          {isPayroll ? (
            <>
              <th
                className="hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight"
                title={tl(
                  "offDayColumnHint",
                  "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
                )}
              >
                {tl("offDayColumn", "Ngày off")}
              </th>
              <th
                className="hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight"
                title={tl(
                  "holidayDayColumnHint",
                  "Khi ngày được đánh dấu «Ngày lễ»: hiển thị HOLIDAY.",
                )}
              >
                {tl("holidayDayColumn", "Ngày lễ")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900"
                style={{ background: "#facc15" }}
                title={tl(
                  "payrollWorkingHoursHint",
                  "Ngày thường: giờ công theo giờ vào–ra. Ngày «Ngày off» (Điểm danh): cột này «-»; cùng quy tắc giờ công hiển thị ở TC off.",
                )}
              >
                {tl("workingHours", "Giờ công")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900"
                style={{ background: "#fb923c" }}
                title={tl(
                  "dayShiftOvertimeHoursHint",
                  "Ca ngày: giờ ra sau 17:30. Ca đêm: «-» (xem TC ca đêm).",
                )}
              >
                {tl("dayShiftOvertimeHours", "TC ca ngày (×1.5)")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold uppercase tracking-wide text-center leading-tight text-gray-900"
                style={{ background: "#c4b5fd" }}
                title={tl(
                  "payrollOffDayTcHint",
                  "Khi «Ngày off» và ca ngày: Giờ công BT + TC chiều/giấy gộp một ô; cột TC ca ngày là «-».",
                )}
              >
                {tl("offDayOvertimeHours", "TC off")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold uppercase tracking-wide text-center leading-tight text-gray-900"
                style={{ background: "#6ee7b7" }}
                title={tl(
                  "payrollHolidayDayWorkingHoursHint",
                  "Khi «Ngày lễ» và ca ngày: Giờ công BT + TC gộp một ô; cột Giờ TC là «-».",
                )}
              >
                {tl("holidayDayWorkingHours", "Giờ công ngày lễ")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold uppercase tracking-wide text-center leading-tight text-gray-900"
                style={{ background: "#38bdf8" }}
                title={tl(
                  "payrollTotalGcDayHint",
                  "Tổng khối ngày: Giờ công + Giờ TC; ngày off/lễ ca ngày ≈ một cột TC off/GC lễ đã gộp (cột Giờ TC «-»); không gồm cột ca đêm.",
                )}
              >
                {tl("payrollTotalGcDay", "Tổng GC")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold uppercase tracking-wide text-center leading-tight text-gray-900"
                style={{ background: "#2dd4bf" }}
                title={tl(
                  "nightShiftWorkingHoursHint",
                  "Ca đêm: từ giờ vào đến mốc 05:00 (cùng ngày nếu vào trước 05:00, không thì 05:00 hôm sau), tối đa 8 giờ.",
                )}
              >
                {tl("nightShiftWorkingHours", "GC ca đêm")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold uppercase tracking-wide text-center leading-tight text-gray-900"
                style={{ background: "#e879f9" }}
                title={tl(
                  "nightShiftOvertimeHoursHint",
                  "Ca đêm: phần làm sau mốc 05:00 — cứ 30 phút = 0,5 giờ TC.",
                )}
              >
                {tl("nightShiftOvertimeHours", "TC ca đêm (×1.5)")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold uppercase tracking-wide text-center leading-tight text-gray-900"
                style={{ background: "#6ee7b7" }}
                title={tl(
                  "nightShiftOffDayWorkingHoursHint",
                  "Khi «Ngày off» và ca đêm: GC + TC ca đêm gộp (cùng quy tắc mốc 05:00 như ngày thường); cột TC ca đêm «-». Ngày không off thì trống.",
                )}
              >
                {tl("nightShiftOffDayWorkingHours", "GC ca đêm off")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold uppercase tracking-wide text-center leading-tight text-gray-900"
                style={{ background: "#a3e635" }}
                title={tl(
                  "payrollHolidayNightWorkingHoursHint",
                  "Khi «Ngày lễ» và ca đêm: GC + TC ca đêm gộp; cột TC ca đêm «-»; cột GC ca đêm «-».",
                )}
              >
                {tl("holidayNightWorkingHours", "GC ca đêm lễ")}
              </th>
              <th
                className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold uppercase tracking-wide text-center leading-tight text-gray-900"
                style={{ background: "#818cf8" }}
                title={tl(
                  "payrollTotalGcNightHint",
                  "Tổng khối ca đêm: GC + TC; ngày off/lễ ca đêm gộp một số (cột TC ca đêm «-»).",
                )}
              >
                {tl("payrollTotalGcNight", "Tổng GC ca đêm")}
              </th>
            </>
          ) : null}
          {showRowModalActions && (
            <th className="px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center">
              {canDeleteRow
                ? tl("actions", "Sửa / Xóa")
                : tl("actionsEditOnly", "Sửa")}
            </th>
          )}
        </tr>
      </thead>
    );
  }

  const showJoinWorkStatusDeptBlock = columnPlan === "full";
  const showDeptColumn = columnPlan === "full" || columnPlan === "compact";

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
        <th
          className={cellClsForAttendanceTable(
            "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center",
          )}
        >
          {tl("stt", "STT")}
        </th>
        <th className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight">
          {tl("mnv", "MNV")}
        </th>
        <th
          className={cellClsForAttendanceTable(
            "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center",
          )}
        >
          {tl("mvt", "MVT")}
        </th>
        <th className="px-1 md:px-2 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight">
          {tl("fullName", "Họ và tên")}
        </th>
        <th
          className={cellClsForAttendanceTable(
            "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center",
          )}
        >
          {tl("gender", "Giới tính")}
        </th>
        {showJoinWorkStatusDeptBlock ? (
          <>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center",
              )}
            >
              {tl("joinDate", "Ngày vào làm")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center",
              )}
            >
              {tl("contractDateColumn", "Ngày HĐ")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center",
              )}
            >
              {tl("departmentCode", "Mã BP")}
            </th>
          </>
        ) : null}
        {showDeptColumn ? (
          <th
            className={cellClsForAttendanceTable(
              "hidden md:table-cell px-1.5 md:px-2 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center",
            )}
          >
            {tl("department", "Bộ phận")}
          </th>
        ) : null}
        <th className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight">
          {tl("timeIn", "Thời gian vào")}
        </th>
        <th
          className={cellClsForAttendanceTable(
            "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center",
          )}
        >
          {tl("timeOut", "Thời gian ra")}
        </th>
        <th
          className="px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight"
          title={tl(
            "leaveTypeColumnHint",
            "Loại phép / trạng thái (PN, …) — sau giờ ra.",
          )}
        >
          {tl("leaveTypeColumn", "Loại phép")}
        </th>
        <th
          className={cellClsForAttendanceTable(
            "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight",
          )}
          title={tl(
            "workShiftColumnHint",
            "Ca làm việc (S1 ngày / S2 đêm) — chỉnh qua nút Sửa khi được phép.",
          )}
        >
          {tl("workShift", "Ca làm việc")}
        </th>
        {!isPayroll ? (
          <>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight",
              )}
              title={tl(
                "offDayColumnHint",
                "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
              )}
            >
              {tl("offDayColumn", "Ngày off")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight",
              )}
              title={tl(
                "holidayDayColumnHint",
                "Khi ngày được đánh dấu «Ngày lễ»: hiển thị HOLIDAY.",
              )}
            >
              {tl("holidayDayColumn", "Ngày lễ")}
            </th>
          </>
        ) : null}
        {isPayroll ? (
          <>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight",
              )}
              title={tl(
                "offDayColumnHint",
                "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
              )}
            >
              {tl("offDayColumn", "Ngày off")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[9px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center leading-tight",
              )}
              title={tl(
                "holidayDayColumnHint",
                "Khi ngày được đánh dấu «Ngày lễ»: hiển thị HOLIDAY.",
              )}
            >
              {tl("holidayDayColumn", "Ngày lễ")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#facc15" }}
              title={tl(
                "payrollWorkingHoursHint",
                "Ngày thường: giờ công theo giờ vào–ra. Ngày «Ngày off» (Điểm danh): cột này «-»; cùng quy tắc giờ công hiển thị ở TC off.",
              )}
            >
              {tl("workingHours", "Giờ công")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#fb923c" }}
              title={tl(
                "dayShiftOvertimeHoursHint",
                "Ca ngày: giờ ra sau 17:30. Ca đêm: «-» (xem TC ca đêm).",
              )}
            >
              {tl("dayShiftOvertimeHours", "TC ca ngày (×1.5)")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#c4b5fd" }}
              title={tl(
                "payrollOffDayTcHint",
                "Khi «Ngày off» và ca ngày: Giờ công BT + TC chiều/giấy gộp một ô; cột TC ca ngày là «-».",
              )}
            >
              {tl("offDayOvertimeHours", "TC off")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#6ee7b7" }}
              title={tl(
                "payrollHolidayDayWorkingHoursHint",
                "Khi «Ngày lễ» và ca ngày: Giờ công BT + TC gộp một ô; cột Giờ TC là «-».",
              )}
            >
              {tl("holidayDayWorkingHours", "Giờ công ngày lễ")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#38bdf8" }}
              title={tl(
                "payrollTotalGcDayHint",
                "Tổng khối ngày: Giờ công + Giờ TC; ngày off/lễ ca ngày ≈ một cột TC off/GC lễ đã gộp (cột Giờ TC «-»); không gồm cột ca đêm.",
              )}
            >
              {tl("payrollTotalGcDay", "Tổng GC")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#2dd4bf" }}
              title={tl(
                "nightShiftWorkingHoursHint",
                "Ca đêm: từ giờ vào đến mốc 05:00 (cùng ngày nếu vào trước 05:00, không thì 05:00 hôm sau), tối đa 8 giờ.",
              )}
            >
              {tl("nightShiftWorkingHours", "GC ca đêm")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#e879f9" }}
              title={tl(
                "nightShiftOvertimeHoursHint",
                "Ca đêm: phần làm sau mốc 05:00 — cứ 30 phút = 0,5 giờ TC.",
              )}
            >
              {tl("nightShiftOvertimeHours", "TC ca đêm (×1.5)")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#6ee7b7" }}
              title={tl(
                "nightShiftOffDayWorkingHoursHint",
                "Khi «Ngày off» và ca đêm: GC + TC ca đêm gộp (cùng quy tắc mốc 05:00 như ngày thường); cột TC ca đêm «-». Ngày không off thì trống.",
              )}
            >
              {tl("nightShiftOffDayWorkingHours", "GC ca đêm off")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#a3e635" }}
              title={tl(
                "payrollHolidayNightWorkingHoursHint",
                "Khi «Ngày lễ» và ca đêm: GC + TC ca đêm gộp; cột TC ca đêm «-»; cột GC ca đêm «-».",
              )}
            >
              {tl("holidayNightWorkingHours", "GC ca đêm lễ")}
            </th>
            <th
              className={cellClsForAttendanceTable(
                "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wide text-center text-gray-900",
              )}
              style={{ background: "#818cf8" }}
              title={tl(
                "payrollTotalGcNightHint",
                "Tổng khối ca đêm: GC + TC; ngày off/lễ ca đêm gộp một số (cột TC ca đêm «-»).",
              )}
            >
              {tl("payrollTotalGcNight", "Tổng GC ca đêm")}
            </th>
          </>
        ) : null}
        {showRowModalActions && (
          <th
            className={cellClsForAttendanceTable(
              "hidden md:table-cell px-1 md:px-1.5 py-px md:py-0.5 text-[10px] md:text-xs font-extrabold text-white uppercase tracking-wide text-center",
            )}
          >
            {canDeleteRow
              ? tl("actions", "Sửa / Xóa")
              : tl("actionsEditOnly", "Sửa")}
          </th>
        )}
      </tr>
    </thead>
  );
}

export default memo(AttendanceTableThead);
