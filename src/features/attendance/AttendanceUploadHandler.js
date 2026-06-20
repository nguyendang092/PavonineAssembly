// AttendanceUploadHandler.js
// Upload Excel: merge (1) `{attendanceRootPath}/{ngày}` đã có + (2) dòng Excel.
import * as XLSX from "@e965/xlsx";
import { ref, set, get } from "firebase/database";
import { getUploadErrorMessage } from "@/utils/uploadErrorMessage";
import {
  mergeAttendanceExcelUploadIntoDaySnapshot,
  stripAttendanceExcelUploadInternalFields,
} from "./attendanceExcelUploadMerge";
import {
  findAttendanceExcelLayout,
  normalizeHeaderCell,
} from "./attendanceExcelUploadLayout";
import {
  canonicalAttendanceLoaiPhepValue,
  normalizeAttendanceDayRecord,
} from "./attendanceGioVaoTypeOptions";
import {
  attendanceFirebaseKeyFromMnv,
  attendanceMnvStorageKey,
} from "@/utils/attendanceEmployeeRecord";
import { isSeasonalAttendanceRoot } from "./attendanceSeasonalStt";
import {
  persistAnnualLeaveYearFromAttendance,
} from "@/features/leave/annualLeaveAttendanceSync";
import { annualLeaveYearFromDateKey } from "@/features/leave/annualLeaveBalanceLookup";

function trimCell(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

/** Cột «Loại phép» (file xuất/mẫu) — không còn cột phép năm tồn (số); ô chỉ số bỏ qua. */
function parseLoaiPhepFromExcelCell(raw) {
  const t = trimCell(raw);
  if (!t) return "";
  if (/^\d+(\.\d+)?$/.test(t)) return "";
  return canonicalAttendanceLoaiPhepValue(t);
}

export const handleUploadExcel = async ({
  e,
  user,
  selectedDate,
  setAlert,
  setIsUploadingExcel,
  t,
  db,
  /** Firebase path gốc (vd. «attendance», «seasonalAttendance») — khớp `AttendanceList` props */
  attendanceRootPath = "attendance",
}) => {
  if (!user) {
    setAlert({
      show: true,
      type: "error",
      message: t("attendanceList.pleaseLogin"),
    });
    return;
  }

  const file = e.target.files?.[0];
  if (!file) return;

  setIsUploadingExcel(true);
  const resetInput = () => {
    if (e?.target) {
      e.target.value = "";
    }
  };

  try {
    const data = await file.arrayBuffer();
    // ⚠️ KHÔNG dùng cellDates: true để tránh lỗi timezone
    const workbook = XLSX.read(data, {
      type: "array",
      cellDates: false, // Giữ nguyên số serial, tự parse sau
    });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error(t("attendanceList.excelNoSheet"));
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Đọc dạng mảng; vị trí bảng dữ liệu tự nhận (file xuất/mẫu có nhiều dòng đầu, hoặc 2 dòng header legacy)
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false, // Trả về giá trị đã format
    });

    const { dataRowStart, mnvCol } = findAttendanceExcelLayout(rows);
    if (!Array.isArray(rows) || rows.length <= dataRowStart) {
      throw new Error(t("attendanceList.excelEmpty"));
    }

    // Bỏ các dòng trước bảng dữ liệu (file xuất/mẫu có nhiều dòng đầu; legacy: 2 dòng header)
    const dataRows = rows.slice(dataRowStart);

    /** Mẫu mới (sau cột «Ngày vào làm»): cột «Ngày HĐ». */
    const headerVnRow = rows[dataRowStart - 2];
    const headerNorm = Array.isArray(headerVnRow)
      ? headerVnRow.map((c) => normalizeHeaderCell(c))
      : [];
    const col6 = headerNorm[6] || "";
    const hasContractDateCol =
      headerNorm.length > 6 &&
      (col6.includes("hợp đồng") ||
        col6.includes("hop dong") ||
        col6.includes("ngày hđ") ||
        col6.includes("ngay hd") ||
        col6.includes("contract date") ||
        col6.includes("contract"));
    const hasProfileExtraCol = hasContractDateCol;

    // ✅ Hàm parse ngày CHUẨN - tránh lệch timezone
    const normalizeDate = (value) => {
      if (value == null || value === "") return "";

      const fmt = (y, m, d) =>
        y && m && d
          ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
          : "";

      // 1️⃣ Số serial Excel (QUAN TRỌNG NHẤT)
      if (typeof value === "number" && Number.isFinite(value)) {
        // Parse trực tiếp từ serial number
        const parsed = XLSX.SSF.parse_date_code(value, {
          date1904: workbook?.Workbook?.WBProps?.date1904 || false,
        });
        if (parsed?.y && parsed?.m && parsed?.d) {
          return fmt(parsed.y, parsed.m, parsed.d);
        }
      }

      // 2️⃣ Date object (nếu có - nhưng không nên xảy ra với cellDates: false)
      if (value instanceof Date && !isNaN(value)) {
        return fmt(
          value.getUTCFullYear(),
          value.getUTCMonth() + 1,
          value.getUTCDate(),
        );
      }

      // 3️⃣ Chuỗi ngày đã được format
      if (typeof value === "string") {
        const str = value.trim();
        if (!str) return "";

        // yyyy-mm-dd hoặc yyyy/mm/dd
        const iso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
        if (iso) return fmt(+iso[1], +iso[2], +iso[3]);

        // dd-mm-yyyy hoặc dd/mm/yyyy
        const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (dmy) return fmt(+dmy[3], +dmy[2], +dmy[1]);

        // dd-MMM-yy (9-Feb-96)
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
            // Pivot year: 70-99 -> 1970-1999, 00-69 -> 2000 + year
            if (year < 100) {
              year = year >= 70 ? 1900 + year : 2000 + year;
            }
            return fmt(year, mon, day);
          }
        }
      }

      return "";
    };

    // Prepare data for Firebase — cùng nhánh với trang đang mở (chính thức / thời vụ)
    const attendanceRef = ref(db, `${attendanceRootPath}/${selectedDate}`);
    const seasonalUpload = isSeasonalAttendanceRoot(attendanceRootPath);
    const dataToUpload = {};

    dataRows.forEach((row, index) => {
      // Cột MNV tại mnvCol (1 hoặc 2 nếu có thêm cột «Ngày» như xuất khoảng ngày)
      const i = mnvCol;
      const stt = row[0];
      const mnv = row[i];
      const mvt = row[i + 1];
      const hoVaTen = row[i + 2];
      const gioiTinh = row[i + 3];
      const ngayVaoLamRaw = row[i + 4];
      const maOffset = hasProfileExtraCol ? 6 : 5;
      const profileExtraRaw = hasProfileExtraCol ? row[i + 5] : "";
      const maBoPhan = row[i + maOffset];
      const boPhan = row[i + maOffset + 1];
      const gioVao = row[i + maOffset + 2];
      const gioRa = row[i + maOffset + 3];
      const caLamViec = row[i + maOffset + 4];
      const lastCol = i + maOffset + 5;
      const wideCol = i + maOffset + 8;
      const rawLast = trimCell(row[lastCol]);
      const rawWide = trimCell(row[wideCol]);
      const loaiPhep =
        parseLoaiPhepFromExcelCell(rawLast) ||
        parseLoaiPhepFromExcelCell(rawWide);

      // Bỏ qua dòng trống hoàn toàn
      const hasValue = row.some((cell) => String(cell || "").trim() !== "");
      if (!hasValue) return;

      const normalizedMNV = attendanceMnvStorageKey(mnv);
      if (!normalizedMNV || normalizedMNV === "0") return;

      const empKey = attendanceFirebaseKeyFromMnv(normalizedMNV);
      if (!empKey) return;
      /** `true` khi ô STT có số hợp lệ — merge: chỉ ghi STT nếu STT trên Firebase đang trống. */
      const excelHasStt =
        trimCell(stt) !== "" && Number.isFinite(Number(stt));
      const sttNum = excelHasStt
        ? Number(stt)
        : Object.keys(dataToUpload).length + 1;

      const ngayHopDongParsed = hasContractDateCol
        ? normalizeDate(profileExtraRaw)
        : "";

      dataToUpload[empKey] = {
        id: empKey,
        stt: sttNum,
        mnv: normalizedMNV,
        mvt: trimCell(mvt),
        hoVaTen: trimCell(hoVaTen),
        gioiTinh: seasonalUpload
          ? normalizeAttendanceGioiTinhValue(trimCell(gioiTinh)) ||
            trimCell(gioiTinh)
          : trimCell(gioiTinh),
        ngayVaoLam: normalizeDate(ngayVaoLamRaw),
        ...(ngayHopDongParsed ? { ngayHopDong: ngayHopDongParsed } : {}),
        maBoPhan: trimCell(maBoPhan),
        boPhan: trimCell(boPhan),
        gioVao: trimCell(gioVao),
        gioRa: trimCell(gioRa),
        caLamViec: trimCell(caLamViec),
        loaiPhep,
        _excelHasStt: excelHasStt,
      };
      dataToUpload[empKey] = normalizeAttendanceDayRecord(dataToUpload[empKey]);
    });

    const snapshot = await get(attendanceRef);
    const existingData = snapshot.val() || {};
    const { mergedData, uploadedCount, duplicateCount } =
      mergeAttendanceExcelUploadIntoDaySnapshot(existingData, dataToUpload, {
        seasonal: isSeasonalAttendanceRoot(attendanceRootPath),
      });

    const payload = {};
    Object.entries(mergedData).forEach(([k, v]) => {
      payload[k] = stripAttendanceExcelUploadInternalFields(v);
    });
    await set(attendanceRef, payload);

    if (!isSeasonalAttendanceRoot(attendanceRootPath)) {
      const year = annualLeaveYearFromDateKey(selectedDate);
      await persistAnnualLeaveYearFromAttendance(db, {
        year,
        attendanceRootPath,
        updatedBy: user?.email ?? "",
      });
    }

    // Show result message
    let message = `✅ Upload thành công ${uploadedCount} nhân viên mới`;
    if (duplicateCount > 0) {
      message += `, cập nhật ${duplicateCount} nhân viên đã tồn tại`;
    }
    setAlert({
      show: true,
      type: "success",
      message: message,
    });
  } catch (err) {
    console.error("Upload Excel error:", err);
    setAlert({
      show: true,
      type: "error",
      message: t("attendanceList.uploadError", {
        error: getUploadErrorMessage(
          err,
          t("attendanceList.uploadCheckFormat"),
        ),
      }),
    });
  } finally {
    resetInput();
    setIsUploadingExcel(false);
  }
};
