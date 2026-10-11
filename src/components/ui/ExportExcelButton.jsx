import React from "react";
import { writeAttendanceDiemDanhWorksheet } from "@/features/attendance/attendanceDiemDanhExcelExport";
import { downloadXlsxBuffer } from "@/utils/downloadXlsxBuffer";

export default function ExportExcelButton({
  data = [],
  selectedDate,
  className = "px-4 py-2 bg-emerald-600 text-white rounded font-bold text-sm shadow hover:bg-emerald-700 transition",
  fileNamePrefix = "PAVONINE_diemDanh",
  sheetName = "Attendance",
  onSuccess,
  onError,
  title = "📥 Xuất Excel",
  /** Điểm danh thời vụ: bỏ cột «Ngày HĐ» (khớp bảng giao diện). */
  omitContractDateColumn = false,
}) {
  const handleClick = async () => {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(sheetName);
      await writeAttendanceDiemDanhWorksheet(worksheet, {
        data,
        selectedDate,
        omitContractDateColumn,
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const now = new Date();
      const dateOut = now.toISOString().slice(0, 10);
      const timeOut = now.toTimeString().slice(0, 8).replace(/:/g, "-");
      downloadXlsxBuffer(
        buffer,
        `${fileNamePrefix}_${dateOut}_${timeOut}.xlsx`,
      );

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
