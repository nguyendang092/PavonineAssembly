import ExcelJS from "exceljs";
import { downloadXlsxBuffer } from "@/utils/downloadXlsxBuffer";
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
  downloadXlsxBuffer(buffer, `bu-cong-${selectedDate}.xlsx`);
  return buCongEmployees.length;
}
