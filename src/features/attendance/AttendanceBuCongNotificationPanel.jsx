import React, { memo } from "react";
import NotificationBell from "@/components/ui/NotificationBell";
import {
  formatAttendanceLeaveTypeColumnForEmployee,
  formatAttendanceTimeInColumnDisplay,
  getAttendanceLeaveTypeColorClassName,
  getAttendanceLeaveTypeRaw,
} from "./attendanceGioVaoTypeOptions";

function AttendanceBuCongNotificationPanel({ buCongEmployees, handleExportBuCongExcel, tl, t }) {
  return (
                  <div className="hidden shrink-0 overflow-visible sm:block">
                    <NotificationBell
                      inline
                      count={buCongEmployees.length}
                      onExport={handleExportBuCongExcel}
                      exportLabel={t("attendanceList.export")}
                    >
                      {buCongEmployees.length === 0 ? (
                        <div
                          style={{
                            textAlign: "center",
                            color: "#888",
                            fontSize: 14,
                            padding: 20,
                          }}
                        >
                          {t("attendanceList.noCompensationEmployees", {
                            defaultValue: "Không có nhân viên bù công nào",
                          })}
                        </div>
                      ) : (
                        <div style={{ maxHeight: 600, overflow: "auto" }}>
                          <table
                            style={{
                              width: "100%",
                              minWidth: 600,
                              borderCollapse: "collapse",
                              fontSize: 14,
                            }}
                          >
                            <thead
                              style={{
                                position: "sticky",
                                top: 0,
                                background: "#e3f2fd",
                                zIndex: 1,
                              }}
                            >
                              <tr>
                                <th style={{ padding: 8 }}>
                                  {tl("colIndex", "STT")}
                                </th>
                                <th style={{ padding: 8 }}>
                                  {tl("colCode", "MNV")}
                                </th>
                                <th style={{ padding: 8 }}>
                                  {tl("colName", "Họ và tên")}
                                </th>
                                <th style={{ padding: 8 }}>
                                  {tl("colDepartment", "Bộ phận")}
                                </th>
                                <th style={{ padding: 8 }}>
                                  {tl("colTimeIn", "Giờ vào")}
                                </th>
                                <th style={{ padding: 8 }}>
                                  {tl("colLeaveType", "Loại phép")}
                                </th>
                                <th style={{ padding: 8 }}>
                                  {tl("colTimeOut", "Giờ ra")}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {buCongEmployees.map((emp, idx) => (
                                <tr
                                  key={emp.id}
                                  style={{
                                    background: idx % 2 === 0 ? "#f8fbff" : "#fff",
                                  }}
                                >
                                  <td style={{ textAlign: "center", padding: 8 }}>
                                    {idx + 1}
                                  </td>
                                  <td style={{ textAlign: "center", padding: 8 }}>
                                    {emp.mnv}
                                  </td>
                                  <td style={{ padding: 8 }}>{emp.hoVaTen}</td>
                                  <td style={{ padding: 8 }}>{emp.boPhan}</td>
                                  <td style={{ textAlign: "center", padding: 8 }}>
                                    {formatAttendanceTimeInColumnDisplay(
                                      emp.gioVao,
                                    )}
                                  </td>
                                  <td style={{ textAlign: "center", padding: 8 }}>
                                    <span
                                      className={`font-semibold ${getAttendanceLeaveTypeColorClassName(
                                        getAttendanceLeaveTypeRaw(emp),
                                      )}`}
                                    >
                                      {formatAttendanceLeaveTypeColumnForEmployee(
                                        emp,
                                      )}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: "center", padding: 8 }}>
                                    {emp.gioRa || "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </NotificationBell>
                  </div>
  );
}

export default memo(AttendanceBuCongNotificationPanel);
