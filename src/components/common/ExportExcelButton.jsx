import React from "react";
import ExcelJS from "exceljs";

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

      // Company info (left) - no border
      worksheet.mergeCells("B1:F1");
      const companyName = worksheet.getCell("B1");
      companyName.value = "CÔNG TY TNHH PAVONINE VINA";
      companyName.font = { bold: true, size: 10 };
      companyName.alignment = { vertical: "top", horizontal: "left" };

      worksheet.mergeCells("B2:F2");
      const companyAddr1 = worksheet.getCell("B2");
      companyAddr1.value =
        "Lots VII-3, VII-2, and part of Lot VII-3, My Xuan B1 - Tien Hung";
      companyAddr1.font = { size: 8, italic: true };
      companyAddr1.alignment = { vertical: "top", horizontal: "left" };

      worksheet.mergeCells("B3:F3");
      const companyAddr2 = worksheet.getCell("B3");
      companyAddr2.value =
        "Industrial Park, Phu My Ward, Ho Chi Minh City, Vietnam";
      companyAddr2.font = { size: 8, italic: true };
      companyAddr2.alignment = { vertical: "top", horizontal: "left" };

      // Approval table (right)
      const approvalHeaders = [
        "Người lập /\nPrepared by",
        "Kiểm tra /\nReviewed by",
        "Phê duyệt /\nApproved by",
      ];
      ["I1", "J1", "K1"].forEach((addr, idx) => {
        const cell = worksheet.getCell(addr);
        cell.value = approvalHeaders[idx];
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };
        cell.font = { bold: true, size: 8 };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
      ["I2", "J2", "K2"].forEach((addr) => {
        const c = worksheet.getCell(addr);
        c.value = "";
        c.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
      worksheet.getRow(1).height = 18;
      worksheet.getRow(2).height = 28;

      // Title + subtitle + date (auto today or selectedDate)
      worksheet.mergeCells("A4:L4");
      const mainTitle = worksheet.getCell("A4");
      mainTitle.value = "DANH SÁCH NHÂN VIÊN HIỆN DIỆN";
      mainTitle.font = { size: 14, bold: true, color: { argb: "FF000000" } };
      mainTitle.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(4).height = 22;

      worksheet.mergeCells("A5:L5");
      const subTitle = worksheet.getCell("A5");
      subTitle.value = "List of Active Employees";
      subTitle.font = { size: 11, bold: true };
      subTitle.alignment = { vertical: "middle", horizontal: "center" };

      worksheet.mergeCells("A6:L6");
      const dateCell = worksheet.getCell("A6");
      const dateStr = selectedDate
        ? new Date(selectedDate).toLocaleDateString("vi-VN")
        : new Date().toLocaleDateString("vi-VN");
      dateCell.value = `Ngày/Date: ${dateStr}`;
      dateCell.font = { size: 9, bold: true };
      dateCell.alignment = { vertical: "middle", horizontal: "center" };

      worksheet.addRow([]); // row 7 blank

      // Legend table
      worksheet.addRow([
        "Ca ngày",
        "S1",
        "1.Phép năm/Annual Leave",
        "PN",
        "6.Không Lương/Unpaid Leave",
        "KL",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
      worksheet.addRow([
        "Ca đêm",
        "S2",
        "2.1/2 ngày phép năm/1/2 day annual Leave",
        "1/2 PN",
        "7.Không phép/Illegal Leave",
        "KP",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
      worksheet.addRow([
        "",
        "",
        "3.Nghỉ TNLĐ/Labor accident",
        "TN",
        "8.Nghỉ ốm/Sick Leave",
        "PO",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
      worksheet.addRow([
        "",
        "",
        "4.Phép cưới/Wedding Leave",
        "PC",
        "9.Thai sản/Maternity",
        "TS",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
      worksheet.addRow([
        "",
        "",
        "5.Phép tang/Funeral Leave",
        "PT",
        "10.Dưỡng sức/Recovery health",
        "DS",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);

      [8, 9, 10, 11, 12].forEach((rowNum) => {
        const row = worksheet.getRow(rowNum);
        row.height = 15;
        row.eachCell((cell, colNumber) => {
          cell.font = { size: 8 };
          cell.alignment = {
            vertical: "top",
            horizontal: "left",
            wrapText: true,
          };
          if (colNumber <= 6) {
            cell.border = {
              top: { style: "hair" },
              left: { style: "hair" },
              bottom: { style: "hair" },
              right: { style: "hair" },
            };
          }
        });
      });

      worksheet.addRow([]); // row 13 blank

      worksheet.mergeCells("E14:I14");
      const mealCountCell = worksheet.getCell("E14");
      mealCountCell.value = "Số lượng cơm ca trưa:";
      mealCountCell.font = {
        size: 10,
        color: { argb: "FFC41E3A" },
        italic: true,
        bold: true,
      };
      mealCountCell.alignment = { vertical: "middle", horizontal: "left" };

      worksheet.addRow([]); // row 15 blank

      const headerVi = [
        "STT",
        "MNV",
        "MVT",
        "Họ và tên",
        "Giới tính",
        "Ngày tháng năm sinh",
        "Mã BP",
        "Bộ phận",
        "Thời gian vào",
        "Thời gian ra",
        "Ca làm việc",
        "Chấm công",
      ];

      const headerEn = [
        "",
        "Code",
        "",
        "Full name",
        "Gender",
        "DoB",
        "Code-Dept",
        "Department",
        "Time in",
        "Time out",
        "Current shift",
        "Timekeeping",
      ];

      worksheet.addRow(headerVi);
      worksheet.addRow(headerEn);

      [16, 17].forEach((rowNum) => {
        const row = worksheet.getRow(rowNum);
        row.height = 25;
        row.eachCell((cell) => {
          cell.font = { bold: true, size: 9, color: { argb: "FF000000" } };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFB0B0B0" },
          };
          cell.alignment = {
            vertical: "middle",
            horizontal: "center",
            wrapText: true,
          };
          cell.border = {
            top: { style: "thin" },
            left: { style: "hair" },
            bottom: { style: "hair" },
            right: { style: "hair" },
          };
        });
      });

      data.forEach((emp, idx) => {
        const row = worksheet.addRow([
          idx + 1,
          emp.mnv || "",
          emp.mvt || "",
          emp.hoVaTen || "",
          emp.gioiTinh === "YES" ? "YES" : "NO",
          emp.ngayThangNamSinh || "",
          emp.maBoPhan || "",
          emp.boPhan || "",
          emp.gioVao || "",
          emp.gioRa || "",
          emp.caLamViec || "",
          emp.chamCong || "",
        ]);

        const isEvenRow = idx % 2 === 0;
        row.eachCell((cell, colNumber) => {
          cell.font = { size: 9 };
          if (colNumber === 4 || colNumber === 8) {
            cell.alignment = {
              vertical: "middle",
              horizontal: "left",
              indent: 1,
            };
          } else {
            cell.alignment = { vertical: "middle", horizontal: "center" };
          }

          cell.border = {
            top: { style: "hair" },
            left: { style: "hair" },
            bottom: { style: "hair" },
            right: { style: "hair" },
          };

          if (isEvenRow) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF0F8FF" },
            };
          }

          if (colNumber === 9 && cell.value) {
            cell.font = { size: 9, color: { argb: "FF006400" }, bold: true };
          }
          if (colNumber === 10 && cell.value) {
            cell.font = { size: 9, color: { argb: "FFDC143C" }, bold: true };
          }
        });
      });

      worksheet.columns = [
        { width: 5 },
        { width: 10 },
        { width: 10 },
        { width: 25 },
        { width: 8 },
        { width: 15 },
        { width: 10 },
        { width: 15 },
        { width: 10 },
        { width: 10 },
        { width: 12 },
        { width: 14 },
      ];

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
    <button onClick={handleClick} className={className}>
      {title}
    </button>
  );
}
