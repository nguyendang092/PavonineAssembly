import React, { useState, useMemo, useRef } from "react";
import ReactDOM from "react-dom";
import "./BirthdayCakeBell.css";
import ExcelJS from "exceljs";

// Nhận employees (danh sách nhân viên) làm prop
export default function BirthdayCakeBell({ employees }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const listRef = useRef(null);

  // Lọc ra những nhân viên có sinh nhật trong tháng hiện tại
  const birthdayList = useMemo(() => {
    const filtered = employees.filter((emp) => {
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
  }, [employees, now]);

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
        `SinhNhatThang${now.getMonth() + 1}`,
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
        "#",
        "Họ và tên",
        "Ngày sinh",
        "Bộ phận",
        "Mã NV",
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
      {ReactDOM.createPortal(
        <button
          className="birthday-cake-bell-btn birthday-cake-bell-shake"
          title="Xem danh sách sinh nhật tháng này"
          onClick={() => setOpen((o) => !o)}
          style={{
            position: "fixed",
            top: 114,
            right: 104,
            zIndex: 2147483647,
            background: "#fff",
            borderRadius: 32,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            padding: 8,
          }}
        >
          <span role="img" aria-label="birthday-cake" style={{ fontSize: 24 }}>
            🎂
          </span>
          {birthdayList.length > 0 && (
            <span className="birthday-cake-bell-badge">
              {birthdayList.length}
            </span>
          )}
        </button>,
        document.body,
      )}

      {open &&
        ReactDOM.createPortal(
          <>
            <div
              className="birthday-cake-bell-overlay"
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                background: "rgba(0,0,0,0.55)",
                zIndex: 2147483646,
              }}
              onClick={() => setOpen(false)}
            />
            <div
              className="birthday-cake-bell-list"
              style={{
                minWidth: 700,
                maxWidth: 700,
                padding: 20,
                zIndex: 2147483647,
                position: "fixed",
                top: 120,
                left: "50%",
                transform: "translateX(-50%)",
                margin: "0 auto",
                display: "flex",
                justifyContent: "center",
                background: "#fff0f6",
                borderRadius: 18,
                boxShadow: "0 8px 32px rgba(255, 77, 109, 0.18)",
                border: "1.5px solid #ffe0ec",
              }}
            >
              <div style={{ width: "100%", maxWidth: 700 }}>
                <div
                  className="birthday-cake-bell-list-title"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 17,
                    marginBottom: 14,
                    color: "#e43c7d",
                    fontWeight: 700,
                    textAlign: "center",
                    letterSpacing: 0.2,
                  }}
                >
                  <span>🎂 Danh sách sinh nhật tháng {now.getMonth() + 1}</span>
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <button
                      onClick={handleExportExcel}
                      className="birthday-download-btn"
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#e43c7d",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "600",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) =>
                        (e.target.style.backgroundColor = "#d02a6b")
                      }
                      onMouseLeave={(e) =>
                        (e.target.style.backgroundColor = "#e43c7d")
                      }
                    >
                      ⬇ Xuất Excel
                    </button>
                    <button
                      onClick={() => setOpen(false)}
                      style={{
                        padding: "4px 10px",
                        backgroundColor: "#ff6b6b",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "16px",
                        fontWeight: "600",
                        transition: "background 0.2s",
                        minWidth: "36px",
                      }}
                      onMouseEnter={(e) =>
                        (e.target.style.backgroundColor = "#ee5a52")
                      }
                      onMouseLeave={(e) =>
                        (e.target.style.backgroundColor = "#ff6b6b")
                      }
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {birthdayList.length === 0 ? (
                  <div
                    className="birthday-cake-bell-empty"
                    style={{
                      textAlign: "center",
                      color: "#888",
                      fontSize: 14,
                      padding: "18px 0",
                    }}
                  >
                    Không có ai sinh nhật tháng này
                  </div>
                ) : (
                  <div
                    style={{
                      overflowX: "auto",
                      maxHeight: 700,
                      overflowY: "auto",
                      paddingBottom: 8,
                    }}
                    ref={listRef}
                  >
                    <table
                      className="birthday-cake-table"
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 14,
                        background: "#fff",
                        borderRadius: 12,
                        boxShadow: "0 2px 8px rgba(255,77,109,0.07)",
                        overflow: "hidden",
                      }}
                    >
                      <thead>
                        <tr style={{ background: "#ffe0ec" }}>
                          <th
                            style={{
                              padding: 7,
                              border: "none",
                              color: "#e43c7d",
                              fontWeight: 700,
                              fontSize: 13,
                              borderTopLeftRadius: 12,
                              textAlign: "center",
                            }}
                          >
                            #
                          </th>
                          <th
                            style={{
                              padding: 7,
                              border: "none",
                              color: "#e43c7d",
                              fontWeight: 700,
                              fontSize: 13,
                              textAlign: "center",
                            }}
                          >
                            Họ và tên
                          </th>
                          <th
                            style={{
                              padding: 7,
                              border: "none",
                              color: "#e43c7d",
                              fontWeight: 700,
                              fontSize: 13,
                              textAlign: "center",
                            }}
                          >
                            Ngày sinh
                          </th>
                          <th
                            style={{
                              padding: 7,
                              border: "none",
                              color: "#e43c7d",
                              fontWeight: 700,
                              fontSize: 13,
                              textAlign: "center",
                            }}
                          >
                            Bộ phận
                          </th>
                          <th
                            style={{
                              padding: 7,
                              border: "none",
                              color: "#e43c7d",
                              fontWeight: 700,
                              fontSize: 13,
                              borderTopRightRadius: 12,
                              textAlign: "center",
                            }}
                          >
                            Mã NV
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {birthdayList.map((emp, idx) => (
                          <tr
                            key={emp.id}
                            style={{
                              background: idx % 2 === 0 ? "#fff6fa" : "#fff",
                              transition: "background 0.2s",
                            }}
                          >
                            <td
                              style={{
                                textAlign: "center",
                                padding: 7,
                                fontWeight: 600,
                                color: "#e43c7d",
                                border: "none",
                              }}
                            >
                              {idx + 1}
                            </td>
                            <td
                              style={{
                                textAlign: "center",
                                padding: 7,
                                fontWeight: 500,
                                border: "none",
                              }}
                            >
                              {emp.hoVaTen}
                            </td>
                            <td
                              style={{
                                textAlign: "center",
                                padding: 7,
                                border: "none",
                              }}
                            >
                              {emp.ngayThangNamSinh}
                            </td>
                            <td
                              style={{
                                textAlign: "center",
                                padding: 7,
                                border: "none",
                              }}
                            >
                              {emp.boPhan || ""}
                            </td>
                            <td
                              style={{
                                textAlign: "center",
                                padding: 7,
                                border: "none",
                              }}
                            >
                              {emp.mnv || ""}
                            </td>
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
