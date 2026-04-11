import React, { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import ReactDOM from "react-dom";
import "./BirthdayCakeBell.css";
import ExcelJS from "exceljs";
import { db, ref, onValue } from "@/services/firebase";
import {
  EMPLOYEE_PROFILES_PATH,
  mergeEmployeeProfileAndDay,
  employeeProfileStorageKeyFromMnv,
} from "@/utils/employeeRosterRecord";

// attendance/{selectedDate} + employeeProfiles (sinh nhật từ hồ sơ)
export default function BirthdayCakeBell({ selectedDate, inline = false }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [attendanceEmployees, setAttendanceEmployees] = useState([]);
  const [profileMap, setProfileMap] = useState({});
  const now = new Date();
  const listRef = useRef(null);

  useEffect(() => {
    const profRef = ref(db, EMPLOYEE_PROFILES_PATH);
    const unsub = onValue(profRef, (snapshot) => {
      const v = snapshot.val();
      setProfileMap(v && typeof v === "object" ? v : {});
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      setAttendanceEmployees([]);
      return;
    }

    const attendanceRef = ref(db, `attendance/${selectedDate}`);
    const unsubscribe = onValue(attendanceRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        const arr = Object.entries(data).map(([id, emp]) => {
          const pk = employeeProfileStorageKeyFromMnv(emp?.mnv);
          const prof = pk ? profileMap[pk] : null;
          return mergeEmployeeProfileAndDay({ ...emp, id }, prof, null);
        });
        setAttendanceEmployees(arr);
      } else {
        setAttendanceEmployees([]);
      }
    });

    return () => unsubscribe();
  }, [selectedDate, profileMap]);

  useEffect(() => {
    if (!open) return;

    const body = document.body;
    const currentCount = Number(body.dataset.popupLockCount || "0");

    if (currentCount === 0) {
      body.dataset.popupLockOverflow = body.style.overflow || "";
      body.dataset.popupLockTouchAction = body.style.touchAction || "";
      body.style.overflow = "hidden";
      body.style.touchAction = "none";
    }

    body.dataset.popupLockCount = String(currentCount + 1);

    return () => {
      const count = Number(body.dataset.popupLockCount || "1");
      const nextCount = Math.max(0, count - 1);

      if (nextCount === 0) {
        body.style.overflow = body.dataset.popupLockOverflow || "";
        body.style.touchAction = body.dataset.popupLockTouchAction || "";
        delete body.dataset.popupLockCount;
        delete body.dataset.popupLockOverflow;
        delete body.dataset.popupLockTouchAction;
      } else {
        body.dataset.popupLockCount = String(nextCount);
      }
    };
  }, [open]);

  // Lọc ra những nhân viên có sinh nhật trong tháng hiện tại
  const birthdayList = useMemo(() => {
    const filtered = attendanceEmployees.filter((emp) => {
      if (!emp.ngayThangNamSinh) return false;
      let dateObj;
      if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(emp.ngayThangNamSinh)) {
        const [y, m, d] = emp.ngayThangNamSinh.split(/[-\/]/);
        dateObj = new Date(Number(y), Number(m) - 1, Number(d));
      } else if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/.test(emp.ngayThangNamSinh)) {
        const [d, m, y] = emp.ngayThangNamSinh.split(/[-\/]/);
        dateObj = new Date(Number(y), Number(m) - 1, Number(d));
      } else {
        return false;
      }
      return (
        dateObj &&
        dateObj.getMonth() === now.getMonth() &&
        !isNaN(dateObj.getTime())
      );
    });
    // Sort by department (boPhan), then by name
    return filtered.sort((a, b) => {
      const depA = (a.boPhan || "").toLowerCase();
      const depB = (b.boPhan || "").toLowerCase();
      if (depA < depB) return -1;
      if (depA > depB) return 1;
      // If same department, sort by name
      return (a.hoVaTen || "").localeCompare(b.hoVaTen || "");
    });
  }, [attendanceEmployees, now]);

  const excelData = useMemo(
    () =>
      birthdayList.map((emp, idx) => ({
        "#": idx + 1,
        "Họ và tên": emp.hoVaTen || "",
        "Ngày sinh": emp.ngayThangNamSinh || "",
        "Bộ phận": emp.boPhan || "",
        "Mã NV": emp.mnv || "",
      })),
    [birthdayList],
  );

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(
        t("birthdayCakeBell.popupTitle", { month: now.getMonth() + 1 }),
      );

      // Set column widths
      worksheet.columns = [
        { width: 8 },
        { width: 20 },
        { width: 15 },
        { width: 20 },
        { width: 12 },
      ];

      // Add header row
      const headerRow = worksheet.addRow([
        t("birthdayCakeBell.colIndex"),
        t("birthdayCakeBell.colName"),
        t("birthdayCakeBell.colBirthdate"),
        t("birthdayCakeBell.colDepartment"),
        t("birthdayCakeBell.colCode"),
      ]);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE43C7D" },
      };
      headerRow.alignment = { horizontal: "center", vertical: "middle" };
      headerRow.height = 18;

      // Add data rows
      excelData.forEach((row) => {
        const dataRow = worksheet.addRow([
          row["#"],
          row["Họ và tên"],
          row["Ngày sinh"],
          row["Bộ phận"],
          row["Mã NV"],
        ]);
        dataRow.alignment = { horizontal: "center", vertical: "middle" };
        dataRow.height = 16;
      });

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `birthday-list-${now.getMonth() + 1}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting Excel:", error);
    }
  };

  return (
    <div>
      {inline ? (
        <button
          className="bday-bell-trigger bday-bell-trigger--inline"
          title={t("birthdayCakeBell.buttonTitle")}
          onClick={() => setOpen((o) => !o)}
        >
          <span
            role="img"
            aria-label="birthday-cake"
            className="bday-bell-icon"
          >
            🎂
          </span>
          {birthdayList.length > 0 && (
            <span className="bday-bell-badge">{birthdayList.length}</span>
          )}
        </button>
      ) : (
        ReactDOM.createPortal(
          <button
            className="bday-bell-trigger bday-bell-trigger--floating"
            title={t("birthdayCakeBell.buttonTitle")}
            onClick={() => setOpen((o) => !o)}
          >
            <span
              role="img"
              aria-label="birthday-cake"
              className="bday-bell-icon"
            >
              🎂
            </span>
            {birthdayList.length > 0 && (
              <span className="bday-bell-badge">{birthdayList.length}</span>
            )}
          </button>,
          document.body,
        )
      )}

      {open &&
        ReactDOM.createPortal(
          <>
            <div className="bday-bell-overlay" onClick={() => setOpen(false)} />
            <div className="bday-bell-popup">
              <div className="bday-bell-shell">
                <div className="bday-bell-header">
                  <span className="bday-bell-title uppercase">
                    {t("birthdayCakeBell.popupTitle", {
                      month: now.getMonth() + 1,
                    })}
                  </span>
                  <div className="bday-bell-header-actions">
                    <button
                      onClick={handleExportExcel}
                      className="bday-bell-btn bday-bell-btn--export"
                    >
                      {t("birthdayCakeBell.exportExcel")}
                    </button>
                    <button
                      onClick={() => setOpen(false)}
                      className="bday-bell-btn bday-bell-btn--close"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {birthdayList.length === 0 ? (
                  <div className="bday-bell-empty">
                    {t("birthdayCakeBell.noBirthdays")}
                  </div>
                ) : (
                  <div className="bday-bell-scroll" ref={listRef}>
                    <table className="bday-bell-table">
                      <thead>
                        <tr className="bday-bell-table-head-row">
                          <th className="bday-bell-th">
                            {t("birthdayCakeBell.colIndex")}
                          </th>
                          <th className="bday-bell-th">
                            {t("birthdayCakeBell.colName")}
                          </th>
                          <th className="bday-bell-th">
                            {t("birthdayCakeBell.colBirthdate")}
                          </th>
                          <th className="bday-bell-th">
                            {t("birthdayCakeBell.colDepartment")}
                          </th>
                          <th className="bday-bell-th">
                            {t("birthdayCakeBell.colCode")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {birthdayList.map((emp, idx) => (
                          <tr key={emp.id} className="bday-bell-row">
                            <td className="bday-bell-td bday-bell-td--index">
                              {idx + 1}
                            </td>
                            <td className="bday-bell-td bday-bell-td--name">
                              {emp.hoVaTen}
                            </td>
                            <td className="bday-bell-td">
                              {emp.ngayThangNamSinh}
                            </td>
                            <td className="bday-bell-td">{emp.boPhan || ""}</td>
                            <td className="bday-bell-td">{emp.mnv || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
