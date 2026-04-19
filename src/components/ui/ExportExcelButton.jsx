import React from "react";
import ExcelJS from "exceljs";
import { writeAttendanceDiemDanhWorksheet } from "@/features/attendance/attendanceDiemDanhExcelExport";

export default function ExportExcelButton({
  data = [],
  selectedDate,
  className = "px-4 py-2 bg-emerald-600 text-white rounded font-bold text-sm shadow hover:bg-emerald-700 transition",
  fileNamePrefix = "PAVONINE_diemDanh",
  sheetName = "Attendance",
  onSuccess,
  onError,
  title = "📥 Xuất Excel",
}) {
  const handleClick = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(sheetName);
      await writeAttendanceDiemDanhWorksheet(worksheet, {
        data,
        selectedDate,
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const now = new Date();
      const dateOut = now.toISOString().slice(0, 10);
      const timeOut = now.toTimeString().slice(0, 8).replace(/:/g, "-");
      a.download = `${fileNamePrefix}_${dateOut}_${timeOut}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      onSuccess && onSuccess("✅ Xuất Excel thành công!");
    } catch (err) {
      console.error("Export Excel Error:", err);
      onError && onError(`❌ Xuất Excel thất bại! ${err.message || ""}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={className}
      title={title}
      aria-label={title}
    >
      {title}
    </button>
  );
}
