import ExcelJS from "exceljs";
import { formatAttendanceTimeInColumnDisplay } from "./attendanceGioVaoTypeOptions";

/** Xuất Excel danh sách bù công — logic tách từ AttendanceList. */
export async function exportAttendanceBuCongExcel({
  buCongEmployees,
  selectedDate,
}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Danh Sach Bu Cong");

  worksheet.columns = [
    { width: 8 },
    { width: 12 },
    { width: 20 },
    { width: 20 },
    { width: 12 },
    { width: 12 },
  ];

  const headerRow = worksheet.addRow([
    "STT",
    "MNV",
    "Họ và tên",
    "Bộ phận",
    "Giờ vào",
    "Giờ ra",
  ]);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1976D2" },
  };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.height = 18;

  buCongEmployees.forEach((emp, idx) => {
    const dataRow = worksheet.addRow([
      idx + 1,
      emp.mnv || "",
      emp.hoVaTen || "",
      emp.boPhan || "",
      formatAttendanceTimeInColumnDisplay(emp.gioVao),
      emp.gioRa || "",
    ]);
    dataRow.alignment = { horizontal: "center", vertical: "middle" };
    dataRow.height = 16;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bu-cong-${selectedDate}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
  return buCongEmployees.length;
}
