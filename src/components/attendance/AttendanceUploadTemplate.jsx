import React, { useCallback } from "react";
import * as XLSX from "xlsx";
import { db, ref, set, get } from "../../services/firebase";

/**
 * AttendanceUploadTemplate
 *
 * Template copied from AttendanceList.handleUploadExcel.
 * Use this component as a base to customize upload logic safely.
 *
 * Props:
 * - user: current user object
 * - selectedDate: target attendance date key (yyyy-mm-dd)
 * - setAlert: function to show toast/alert
 * - onClose: optional callback after upload completes
 */
function AttendanceUploadTemplate({ user, selectedDate, setAlert, onClose }) {
  const handleUploadExcel = useCallback(
    async (e) => {
      if (!user) {
        setAlert({
          show: true,
          type: "error",
          message: "Vui lòng đăng nhập để thực hiện thao tác này",
        });
        return;
      }

      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, {
          type: "array",
          cellDates: false,
        });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error("File Excel không có sheet");
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
          raw: false,
        });

        if (!Array.isArray(rows) || rows.length <= 2) {
          throw new Error("File trống hoặc không đọc được dữ liệu");
        }

        const dataRows = rows.slice(2);

        const normalizeDate = (value) => {
          if (value == null || value === "") return "";

          const fmt = (y, m, d) =>
            y && m && d
              ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
              : "";

          if (typeof value === "number" && Number.isFinite(value)) {
            const parsed = XLSX.SSF.parse_date_code(value, {
              date1904: workbook?.Workbook?.WBProps?.date1904 || false,
            });
            if (parsed?.y && parsed?.m && parsed?.d) {
              return fmt(parsed.y, parsed.m, parsed.d);
            }
          }

          if (value instanceof Date && !isNaN(value)) {
            return fmt(
              value.getUTCFullYear(),
              value.getUTCMonth() + 1,
              value.getUTCDate(),
            );
          }

          if (typeof value === "string") {
            const str = value.trim();
            if (!str) return "";

            const iso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
            if (iso) return fmt(+iso[1], +iso[2], +iso[3]);

            const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
            if (dmy) return fmt(+dmy[3], +dmy[2], +dmy[1]);

            const monthNames = {
              jan: 1,
              feb: 2,
              mar: 3,
              apr: 4,
              may: 5,
              jun: 6,
              jul: 7,
              aug: 8,
              sep: 9,
              oct: 10,
              nov: 11,
              dec: 12,
            };
            const dmyText = str.match(
              /^(\d{1,2})[-\s]?([a-zA-Z]{3})[-\s]?(\d{2,4})$/i,
            );
            if (dmyText) {
              const day = +dmyText[1];
              const mon = monthNames[dmyText[2].toLowerCase()];
              if (mon) {
                let year = +dmyText[3];
                if (year < 100) {
                  year = year >= 70 ? 1900 + year : 2000 + year;
                }
                return fmt(year, mon, day);
              }
            }
          }

          return "";
        };

        const attendanceRef = ref(db, `attendance/${selectedDate}`);
        const dataToUpload = {};

        const normalizeMNV = (value) => {
          if (value === undefined || value === null) return "";
          const strValue = String(value).trim();
          if (!strValue) return "";
          const numericValue = Number(strValue);
          return Number.isFinite(numericValue)
            ? String(numericValue)
            : strValue;
        };

        dataRows.forEach((row, index) => {
          const [
            stt,
            mnv,
            mvt,
            hoVaTen,
            gioiTinh,
            ngayThangNamSinh,
            maBoPhan,
            boPhan,
            gioVao,
            gioRa,
            caLamViec,
            chamCong,
          ] = row;

          const hasValue = row.some((cell) => String(cell || "").trim() !== "");
          if (!hasValue) return;

          const mnvNum = Number(mnv);
          if (!Number.isFinite(mnvNum) || mnvNum === 0) return;

          const normalizedMNV = normalizeMNV(mnvNum);
          if (!normalizedMNV) return;

          const existingUploadKey = Object.keys(dataToUpload).find(
            (k) => normalizeMNV(dataToUpload[k]?.mnv) === normalizedMNV,
          );
          if (existingUploadKey) {
            delete dataToUpload[existingUploadKey];
          }

          const empKey = `emp_${index}`;
          const sttNum = Number.isFinite(Number(stt))
            ? Number(stt)
            : Object.keys(dataToUpload).length + 1;

          dataToUpload[empKey] = {
            id: empKey,
            stt: sttNum,
            mnv: normalizedMNV,
            mvt: mvt || "",
            hoVaTen: hoVaTen || "",
            gioiTinh: gioiTinh || "YES",
            ngayThangNamSinh: normalizeDate(ngayThangNamSinh),
            maBoPhan: maBoPhan || "",
            boPhan: boPhan || "",
            gioVao: gioVao || "",
            gioRa: gioRa || "",
            caLamViec: caLamViec || "",
            chamCong: chamCong || "",
          };
        });

        let uploadedCount = 0;
        let duplicateCount = 0;

        const snapshot = await get(attendanceRef);
        const existingData = snapshot.val() || {};
        const existingKeyByMNV = {};
        Object.entries(existingData).forEach(([key, emp]) => {
          const normalizedMNV = normalizeMNV(emp?.mnv);
          if (normalizedMNV && !existingKeyByMNV[normalizedMNV]) {
            existingKeyByMNV[normalizedMNV] = key;
          }
        });

        const mergedData = { ...existingData };

        Object.entries(dataToUpload).forEach(([key, newEmp]) => {
          const normalizedNewMNV = normalizeMNV(newEmp?.mnv);
          const existingKey = existingKeyByMNV[normalizedNewMNV];
          const isDuplicate = Boolean(existingKey);

          if (isDuplicate) {
            if (existingKey) {
              const oldEmp = mergedData[existingKey] || {};
              const mergedEmp = { ...oldEmp };

              Object.keys(newEmp).forEach((field) => {
                if (field === "id") return;

                if (field === "gioVao") {
                  const newValue = newEmp[field];
                  if (
                    newValue !== undefined &&
                    newValue !== null &&
                    newValue !== ""
                  ) {
                    mergedEmp[field] = newValue;
                  }
                } else if (
                  newEmp[field] !== undefined &&
                  newEmp[field] !== ""
                ) {
                  mergedEmp[field] = newEmp[field];
                }
              });

              mergedData[existingKey] = mergedEmp;
            }
            duplicateCount++;
          } else {
            mergedData[key] = newEmp;
            if (normalizedNewMNV) {
              existingKeyByMNV[normalizedNewMNV] = key;
            }
            uploadedCount++;
          }
        });

        await set(attendanceRef, mergedData);

        let message = `✅ Upload thành công ${uploadedCount} nhân viên mới`;
        if (duplicateCount > 0) {
          message += `, cập nhật ${duplicateCount} nhân viên đã tồn tại`;
        }

        setAlert({
          show: true,
          type: "success",
          message,
        });

        if (e.target) {
          e.target.value = "";
        }
      } catch (err) {
        console.error("Upload Excel error:", err);
        setAlert({
          show: true,
          type: "error",
          message:
            "❌ Lỗi khi upload file: " +
            (err?.message || "Vui lòng kiểm tra định dạng file"),
        });
      } finally {
        if (onClose) onClose();
      }
    },
    [user, selectedDate, setAlert, onClose],
  );

  const isAdminOrHR =
    user?.email === "admin@gmail.com" || user?.email === "hr@pavonine.net";

  if (!isAdminOrHR) return null;

  return (
    <label className="w-full px-5 py-3.5 text-left hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 transition-all duration-200 flex items-center gap-3 border-b-2 border-gray-200 group cursor-pointer">
      <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
        📤
      </span>
      <div className="flex flex-col">
        <span className="font-bold text-gray-800 text-sm group-hover:text-emerald-700 transition-colors">
          Upload Excel theo ngày (template)
        </span>
        <span className="text-xs text-gray-500 mt-0.5">
          Base code copied from AttendanceList để bạn tùy chỉnh
        </span>
      </div>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleUploadExcel}
        className="hidden"
      />
    </label>
  );
}

export default AttendanceUploadTemplate;
