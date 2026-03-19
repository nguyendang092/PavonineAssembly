import React, { useCallback } from "react";
import * as XLSX from "xlsx";
import { db, ref, update } from "../../services/firebase";

/**
 * AnnualLeaveUpload
 *
 * Renders the "Upload phép năm" menu item (label + hidden file input).
 * Handles reading the Annual Leave Excel and writing to Firebase employees node.
 *
 * Props:
 *   user    – current user object (from UserContext)
 *   setAlert – state setter for alert messages { show, type, message }
 *   onClose  – called after upload finishes (e.g. close action dropdown)
 */
function AnnualLeaveUpload({ user, setAlert, onClose }) {
  const handleUploadAnnualLeaveExcel = useCallback(
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
        const workbook = XLSX.read(data, { type: "array", cellDates: false });
        if (!workbook.SheetNames?.length) {
          throw new Error("File Excel không có sheet");
        }

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        // rowOffset: sheet_to_json trả về rows tính từ đầu !ref, không phải từ A1.
        // encode_cell cần cộng offset này để ánh xạ đúng sang địa chỉ ô thực.
        const rowOffset = sheet["!ref"]
          ? XLSX.utils.decode_range(sheet["!ref"]).s.r
          : 0;
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
          raw: false,
        });

        if (!Array.isArray(rows) || rows.length === 0) {
          throw new Error("File Excel trống hoặc không đọc được dữ liệu");
        }

        const normalizeHeader = (value) =>
          String(value || "")
            .toLowerCase()
            .replace(/\n/g, " ")
            .replace(/[^a-z0-9\u00c0-\u1ef9]+/gi, "")
            .trim();

        const buildMergedHeaders = (table, startRow, headerDepth = 4) => {
          const maxCols = Math.max(
            ...table
              .slice(startRow, Math.min(table.length, startRow + headerDepth))
              .map((r) => (Array.isArray(r) ? r.length : 0)),
            0,
          );
          return Array.from({ length: maxCols }, (_, colIdx) => {
            const parts = [];
            for (
              let r = startRow;
              r < Math.min(table.length, startRow + headerDepth);
              r++
            ) {
              const cell = table[r]?.[colIdx];
              const normalized = normalizeHeader(cell);
              if (normalized) parts.push(normalized);
            }
            return parts.join("");
          });
        };

        const findCol = (headerArray, predicates) =>
          headerArray.findIndex((h) => predicates.some((p) => h.includes(p)));

        let headerRowIndex = -1;
        let headers = [];
        for (let i = 0; i < Math.min(rows.length, 12); i++) {
          const mergedHeaders = buildMergedHeaders(rows, i, 4);
          const hasEmpCode =
            findCol(mergedHeaders, ["emplcode", "employeecode", "mnv"]) >= 0;
          const hasAnnualLeave =
            findCol(mergedHeaders, ["annualleave", "phepnam", "currentyear"]) >=
            0;
          if (hasEmpCode && hasAnnualLeave) {
            headerRowIndex = i;
            headers = mergedHeaders;
            break;
          }
        }

        if (headerRowIndex < 0) {
          throw new Error(
            "Không tìm thấy dòng tiêu đề phù hợp (EMPL.CODE / ANNUAL LEAVE)",
          );
        }

        // Mapping profile cố định theo file hiện tại.
        // A:No, B:MNV, C:MVT, D:Full Name, E:Date of Birth, F:Sub-Department, G:Start Working Date
        const colNo = 0;
        const colMnv = 1;
        const colMvt = 2;
        const colFullName = 3;
        const colDateOfBirth = 4;
        const colSubDepartment = 5;
        const colStartWorkingDate = 6;

        // Mapping cột phép: ưu tiên dò theo header, fallback về cột cố định J..O.
        const colAnnualCurrentDetected = 7; // ANNUAL LEAVE IN CURRENT YEAR
        const colBonusDetected = findCol(headers, [
          "BONUS ANNUAL LEAVE (Environment)",
        ]);
        const colCompensatoryDetected = findCol(headers, [
          "COMPENSATORY DAY OFF",
        ]);
        const colTotalDetected = findCol(headers, ["TOTAL ANNUAL LEAVE"]);
        const colUsedDetected = findCol(headers, ["ANNUAL LEAVE USED"]);
        const colBalanceDetected = findCol(headers, ["BALANCE", "CONLAI"]);

        const colAnnualCurrent =
          colAnnualCurrentDetected >= 0 ? colAnnualCurrentDetected : 9;
        const colBonus = colBonusDetected >= 0 ? colBonusDetected : 10;
        const colCompensatory =
          colCompensatoryDetected >= 0 ? colCompensatoryDetected : 11;
        const colTotal = colTotalDetected >= 0 ? colTotalDetected : 12;
        const colUsed = colUsedDetected >= 0 ? colUsedDetected : 13;
        const colBalance = colBalanceDetected >= 0 ? colBalanceDetected : 14;

        console.info("[AnnualLeaveUpload] column-map", {
          colNo,
          colMnv,
          colMvt,
          colFullName,
          colDateOfBirth,
          colSubDepartment,
          colStartWorkingDate,
          colAnnualCurrent,
          colBonus,
          colCompensatory,
          colTotal,
          colUsed,
          colBalance,
        });

        if (colMnv < 0 || colAnnualCurrent < 0) {
          throw new Error(
            "Thiếu cột bắt buộc: EMPL.CODE hoặc ANNUAL LEAVE IN CURRENT YEAR",
          );
        }

        const normalizeMNV = (value) => {
          if (value == null) return "";
          const text = String(value).trim();
          if (!text) return "";
          const num = Number(text);
          return Number.isFinite(num) ? String(num) : text;
        };

        const isLikelyEmployeeCode = (value) =>
          /^\d+$/.test(String(value || "").trim());

        const parseMaybeNumber = (value) => {
          if (value == null) return null;
          const raw = String(value).trim();
          if (!raw || raw === "-" || raw === "--") return null;
          const normalized = raw.replace(/,/g, "");
          const num = Number(normalized);
          return Number.isFinite(num) ? num : null;
        };

        const parseNumberFromCell = (rowIndex, colIndex, rowFallback) => {
          if (colIndex < 0) return null;
          const addr = XLSX.utils.encode_cell({
            r: rowOffset + rowIndex,
            c: colIndex,
          });
          const cell = sheet?.[addr];

          // Với cell công thức, ưu tiên giá trị hiển thị (w) trước để tránh cached v bị cũ.
          if (cell) {
            if (cell.f) {
              if (cell.w != null) {
                const parsedW = parseMaybeNumber(cell.w);
                if (parsedW != null) return parsedW;
              }
              const parsedFallback = parseMaybeNumber(rowFallback?.[colIndex]);
              if (parsedFallback != null) return parsedFallback;
              if (cell.v != null) {
                const parsedV = parseMaybeNumber(cell.v);
                if (parsedV != null) return parsedV;
              }
              return null;
            }

            if (typeof cell.v === "number" && Number.isFinite(cell.v)) {
              return cell.v;
            }

            if (cell.v != null) {
              const parsedV = parseMaybeNumber(cell.v);
              if (parsedV != null) return parsedV;
            }

            if (cell.w != null) {
              const parsedW = parseMaybeNumber(cell.w);
              if (parsedW != null) return parsedW;
            }
          }

          return parseMaybeNumber(rowFallback?.[colIndex]);
        };

        const parseMaybeDateText = (value) => {
          if (value == null) return "";
          if (typeof value === "number" && Number.isFinite(value)) {
            const parsed = XLSX.SSF.parse_date_code(value, {
              date1904: workbook?.Workbook?.WBProps?.date1904 || false,
            });
            if (parsed?.y && parsed?.m && parsed?.d) {
              return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
            }
          }
          const text = String(value).trim();
          if (!text || text === "-" || text === "--") return "";
          return text;
        };

        const textOrDash = (value) => {
          const text = String(value || "").trim();
          return text || "-";
        };

        const numberOrDash = (value) => (value == null ? "-" : value);
        const strictNumberOrDash = (value) => {
          if (value == null) return "-";
          const num = Number(value);
          return Number.isFinite(num) ? num : "-";
        };

        const updatesByMnv = {};
        let skippedCount = 0;

        let dataStartRow = headerRowIndex + 1;
        while (dataStartRow < rows.length) {
          const candidate = rows[dataStartRow] || [];
          const mnvCandidate = normalizeMNV(candidate[colMnv]);
          const hasAnyValue = candidate.some(
            (cell) => String(cell || "").trim() !== "",
          );
          if (isLikelyEmployeeCode(mnvCandidate) && hasAnyValue) break;
          dataStartRow++;
        }

        for (let i = dataStartRow; i < rows.length; i++) {
          const row = rows[i] || [];
          const hasAnyValue = row.some(
            (cell) => String(cell || "").trim() !== "",
          );
          if (!hasAnyValue) continue;

          const mnv = normalizeMNV(row[colMnv]);
          if (!mnv || !isLikelyEmployeeCode(mnv)) {
            skippedCount++;
            continue;
          }

          const no = parseNumberFromCell(i, colNo, row);
          // Cột ANNUAL LEAVE IN CURRENT YEAR: đọc theo cột đã detect + parser cell.
          const annualCurrent = parseNumberFromCell(i, colAnnualCurrent, row);
          const bonus = parseNumberFromCell(i, colBonus, row);
          const compensatory =
            colCompensatory >= 0
              ? parseNumberFromCell(i, colCompensatory, row)
              : null;
          const annualTotal =
            colTotal >= 0 ? parseNumberFromCell(i, colTotal, row) : null;
          const annualUsed =
            colUsed >= 0 ? parseNumberFromCell(i, colUsed, row) : null;
          const annualBalance =
            colBalance >= 0 ? parseNumberFromCell(i, colBalance, row) : null;

          const mvt = colMvt >= 0 ? String(row[colMvt] || "").trim() : "";
          const fullName =
            colFullName >= 0 ? String(row[colFullName] || "").trim() : "";
          const dateOfBirth =
            colDateOfBirth >= 0 ? parseMaybeDateText(row[colDateOfBirth]) : "";
          const subDepartment =
            colSubDepartment >= 0
              ? String(row[colSubDepartment] || "").trim()
              : "";
          const startWorkingDate =
            colStartWorkingDate >= 0
              ? parseMaybeDateText(row[colStartWorkingDate])
              : "";

          const computedTotal =
            annualTotal != null
              ? annualTotal
              : (annualCurrent || 0) + (bonus || 0) + (compensatory || 0);

          // Luôn ghi đủ bộ field để dữ liệu nhất quán với form phép năm.
          updatesByMnv[mnv] = {
            ...(updatesByMnv[mnv] || { mnv }),
            NO: numberOrDash(no),
            MVT: textOrDash(mvt),
            fullname: textOrDash(fullName),
            dateOfBirth: textOrDash(dateOfBirth),
            subDepartment: textOrDash(subDepartment),
            startWorkingDate: textOrDash(startWorkingDate),
            annualLeaveInCurrentYear: numberOrDash(annualCurrent),
            bonusAnnualLeaveEnvironment: numberOrDash(bonus),
            compensatoryDayOff: numberOrDash(compensatory),
            totalAnnualLeave: strictNumberOrDash(annualTotal),
            annualLeaveUsed: strictNumberOrDash(annualUsed),
            balance: strictNumberOrDash(annualBalance),
          };
        }

        const mnvList = Object.keys(updatesByMnv);
        if (mnvList.length === 0) {
          throw new Error("Không có dữ liệu phép năm hợp lệ để cập nhật");
        }

        let successCount = 0;
        let failCount = 0;
        const failedMnv = [];

        for (const mnv of mnvList) {
          try {
            await update(ref(db, `employees/${mnv}`), updatesByMnv[mnv]);
            successCount++;
          } catch (writeErr) {
            failCount++;
            failedMnv.push(mnv);
            console.error(
              `Annual leave update failed for MNV ${mnv}:`,
              writeErr,
            );
          }
        }

        if (successCount === 0) {
          throw new Error(
            "Không ghi được dữ liệu lên Firebase (kiểm tra quyền ghi nhánh employees)",
          );
        }

        setAlert({
          show: true,
          type: "success",
          message: `✅ Cập nhật phép năm: ${successCount} nhân viên${
            skippedCount > 0 ? `, bỏ qua ${skippedCount} dòng` : ""
          }${
            failCount > 0
              ? `, lỗi ${failCount} nhân viên (${failedMnv.slice(0, 5).join(", ")}${failCount > 5 ? ", ..." : ""})`
              : ""
          }`,
        });

        if (e.target) e.target.value = "";
      } catch (err) {
        console.error("Upload annual leave Excel error:", err);
        setAlert({
          show: true,
          type: "error",
          message:
            "❌ Lỗi import phép năm: " +
            (err?.message || "Vui lòng kiểm tra định dạng file"),
        });
      } finally {
        if (onClose) onClose();
      }
    },
    [user, setAlert, onClose],
  );

  const isAdminOrHR =
    user?.email === "admin@gmail.com" || user?.email === "hr@pavonine.net";

  if (!isAdminOrHR) return null;

  return (
    <label className="w-full px-5 py-3.5 text-left hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 transition-all duration-200 flex items-center gap-3 border-b-2 border-gray-200 group cursor-pointer">
      <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
        🧾
      </span>
      <div className="flex flex-col">
        <span className="font-bold text-gray-800 text-sm group-hover:text-emerald-700 transition-colors">
          Upload phép năm
        </span>
        <span className="text-xs text-gray-500 mt-0.5">
          Import từ form Annual Leave (EMPL.CODE, Annual Leave...)
        </span>
      </div>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleUploadAnnualLeaveExcel}
        className="hidden"
      />
    </label>
  );
}

export default AnnualLeaveUpload;
