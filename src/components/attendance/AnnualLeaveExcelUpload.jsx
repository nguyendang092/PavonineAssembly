import React, { useCallback } from "react";
import * as XLSX from "xlsx";
import { db, ref, update } from "../../services/firebase";

const AUTHORIZED_EMAILS = new Set(["admin@gmail.com", "hr@pavonine.net"]);

// đọc cell theo column letter
const getCell = (sheet, col, row) => {
  const cell = sheet[`${col}${row}`];
  return cell ? cell.v : "";
};

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const normalized = String(value).trim().replace(/,/g, ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

function AnnualLeaveExcelUpload({ user, onAlert, onUploaded }) {
  const showAlert = (type, message) => {
    if (onAlert) onAlert({ show: true, type, message });
    else alert(message);
  };

  const handleFileChange = useCallback(
    async (event) => {
      if (!user) {
        showAlert("error", "Vui lòng đăng nhập");
        return;
      }

      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const buffer = await file.arrayBuffer();

        const workbook = XLSX.read(buffer, { type: "array" });

        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        const range = XLSX.utils.decode_range(sheet["!ref"]);

        const updates = {};

        let count = 0;

        // bắt đầu từ dòng 3 (bỏ header + filter row)
        for (let r = 3; r <= range.e.r + 1; r++) {
          const mnv = getCell(sheet, "D", r);

          if (!mnv) continue;

          updates[`employees/${mnv}`] = {
            no: getCell(sheet, "C", r),

            mnv: getCell(sheet, "D", r),

            mvt: getCell(sheet, "E", r),

            fullName: getCell(sheet, "F", r),

            dateOfBirth: getCell(sheet, "G", r),

            department: getCell(sheet, "H", r),

            startWorkingDate: getCell(sheet, "I", r),

            annualLeaveCurrentYear: toNumberOrNull(getCell(sheet, "J", r)),

            bonusAnnualLeave: getCell(sheet, "K", r),

            compensatoryDayOff: getCell(sheet, "L", r),

            totalAnnualLeave: getCell(sheet, "M", r),

            annualLeaveUsed: getCell(sheet, "N", r),

            balance: getCell(sheet, "O", r),

            updatedAt: new Date().toISOString(),
          };

          count++;
        }

        await update(ref(db), updates);

        showAlert("success", `Upload thành công ${count} nhân viên`);

        if (onUploaded) onUploaded();
      } catch (error) {
        console.error(error);

        showAlert("error", "Upload thất bại");
      } finally {
        event.target.value = "";
      }
    },
    [user],
  );

  if (!user || !AUTHORIZED_EMAILS.has(user.email)) return null;

  return (
    <label className="w-full px-5 py-3 flex items-center gap-3 cursor-pointer border-b">
      📊 Upload phép năm
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
      />
    </label>
  );
}

export default AnnualLeaveExcelUpload;
