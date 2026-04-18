// AttendanceUploadHandler.js
// This module exports the Excel upload handler for attendance data.
import * as XLSX from "@e965/xlsx";
import { ref, set, get } from "firebase/database";
import { getDateKeyBySubtractDays } from "@/utils/dateKey";
import { getUploadErrorMessage } from "@/utils/uploadErrorMessage";
import {
  employeeProfileStorageKeyFromMnv,
  isEmployeeResigned,
  businessEmployeeCode,
  buildPavoEmployeeId,
  normalizeEmployeeCode,
} from "@/utils/employeeRosterRecord";
import {
  hasAttendanceExcelCellValue,
  mergeAttendanceExcelIntoExistingRecord,
  stripAttendanceExcelUploadInternalFields,
} from "./attendanceExcelUploadMerge";

/** Tìm hồ sơ theo MNV (cột Excel số) — khớp key node hoặc trường mnv. */
function findProfileForMnv(profileMap, normalizedMnvDigits) {
  if (!profileMap || typeof profileMap !== "object") return null;
  const pk = employeeProfileStorageKeyFromMnv(normalizedMnvDigits);
  if (pk && profileMap[pk]) return profileMap[pk];
  const target = normalizeEmployeeCode(
    buildPavoEmployeeId(String(normalizedMnvDigits).trim()),
  );
  if (!target) return null;
  for (const prof of Object.values(profileMap)) {
    if (!prof || typeof prof !== "object") continue;
    const bc = businessEmployeeCode({ mnv: prof.mnv });
    if (bc && normalizeEmployeeCode(bc) === target) return prof;
  }
  return null;
}

export const handleUploadExcel = async ({
  e,
  user,
  selectedDate,
  setAlert,
  setIsUploadingExcel,
  t,
  db,
  employeeProfilesMap = {},
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

    // Đọc dạng mảng để bỏ qua 2 dòng header (VN + EN)
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false, // Trả về giá trị đã format
    });

    if (!Array.isArray(rows) || rows.length <= 2) {
      throw new Error(t("attendanceList.excelEmpty"));
    }

    // Bỏ 2 dòng tiêu đề, phần còn lại là dữ liệu
    const dataRows = rows.slice(2);

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

    // Prepare data for Firebase
    // Use the selectedDate from the date picker, not the current date
    const attendanceRef = ref(db, `attendance/${selectedDate}`);
    const dataToUpload = {};
    let skippedResigned = 0;

    // Chuẩn hóa MNV để tránh lệch kiểu dữ liệu (number/string) gây trùng.
    const normalizeMNV = (value) => {
      if (value === undefined || value === null) return "";
      const strValue = String(value).trim();
      if (!strValue) return "";
      const numericValue = Number(strValue);
      return Number.isFinite(numericValue) ? String(numericValue) : strValue;
    };

    const getFirstNonEmptyValue = (...values) => {
      for (const value of values) {
        if (value !== undefined && value !== null) {
          const text = String(value).trim();
          if (text !== "") return text;
        }
      }
      return "";
    };

    const trimCell = (value) =>
      value === undefined || value === null ? "" : String(value).trim();

    dataRows.forEach((row, index) => {
      // Kỳ vọng thứ tự cột: STT, MNV, MVT, Họ và tên, Giới tính, Ngày bắt đầu,
      // Mã BP, Bộ phận, Thời gian vào, Thời gian ra, Ca làm việc, PN tồn (ưu tiên cột P nếu có)
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
      ] = row;
      const pnTonRaw = getFirstNonEmptyValue(row[11], row[14]);

      // Bỏ qua dòng trống hoàn toàn
      const hasValue = row.some((cell) => String(cell || "").trim() !== "");
      if (!hasValue) return;

      // Chỉ giữ các dòng có MNV là số
      const mnvNum = Number(mnv);
      if (!Number.isFinite(mnvNum) || mnvNum === 0) return;

      const normalizedMNV = normalizeMNV(mnvNum);
      if (!normalizedMNV) return;

      const profRow = findProfileForMnv(employeeProfilesMap, normalizedMNV);
      if (profRow && isEmployeeResigned(profRow)) {
        skippedResigned += 1;
        return;
      }

      // Trong cùng 1 file, nếu trùng MNV thì lấy dòng xuất hiện sau cùng.
      const existingUploadKey = Object.keys(dataToUpload).find(
        (k) => normalizeMNV(dataToUpload[k]?.mnv) === normalizedMNV,
      );
      if (existingUploadKey) {
        delete dataToUpload[existingUploadKey];
      }

      const empKey = `emp_${index}`;
      /** `true` khi ô STT có số hợp lệ — merge: chỉ ghi STT nếu STT trên Firebase đang trống. */
      const excelHasStt =
        trimCell(stt) !== "" && Number.isFinite(Number(stt));
      const sttNum = excelHasStt
        ? Number(stt)
        : Object.keys(dataToUpload).length + 1;

      dataToUpload[empKey] = {
        id: empKey,
        stt: sttNum,
        mnv: normalizedMNV,
        mvt: trimCell(mvt),
        hoVaTen: trimCell(hoVaTen),
        gioiTinh: trimCell(gioiTinh),
        ngayThangNamSinh: normalizeDate(ngayThangNamSinh),
        maBoPhan: trimCell(maBoPhan),
        boPhan: trimCell(boPhan),
        gioVao: trimCell(gioVao),
        gioRa: trimCell(gioRa),
        caLamViec: trimCell(caLamViec),
        pnTon: trimCell(pnTonRaw),
        _excelHasStt: excelHasStt,
      };
    });

    // Upload to Firebase - Merge with existing data to prevent data loss
    let uploadedCount = 0;
    let duplicateCount = 0;

    // Lấy pnTon từ đúng ngày liền trước (lịch) để carry-forward nếu Excel không có
    const yesterdayKey = getDateKeyBySubtractDays(selectedDate, 1);
    const yesterdaySnap = await get(ref(db, `attendance/${yesterdayKey}`));
    const prevData = yesterdaySnap.val() || {};
    const prevPnTonByMNV = {};
    Object.values(prevData).forEach((emp) => {
      const key = normalizeMNV(emp?.mnv);
      const val = String(emp?.pnTon ?? emp?.phepNam ?? "").trim();
      if (key && val) prevPnTonByMNV[key] = val;
    });

    // Get existing data to merge and check for duplicates
    const snapshot = await get(attendanceRef);
    const existingData = snapshot.val() || {};
    const existingKeyByMNV = {};
    Object.entries(existingData).forEach(([key, emp]) => {
      const normalizedMNV = normalizeMNV(emp?.mnv);
      if (normalizedMNV && !existingKeyByMNV[normalizedMNV]) {
        existingKeyByMNV[normalizedMNV] = key;
      }
    });

    // Merge new data with existing data, avoiding duplicates
    const mergedData = { ...existingData };

    Object.entries(dataToUpload).forEach(([key, newEmp]) => {
      const normalizedNewMNV = normalizeMNV(newEmp?.mnv);
      const existingKey = existingKeyByMNV[normalizedNewMNV];
      const isDuplicate = Boolean(existingKey);
      if (isDuplicate) {
        if (existingKey) {
          const oldEmp = mergedData[existingKey] || {};
          const mergedEmp = mergeAttendanceExcelIntoExistingRecord(
            oldEmp,
            newEmp,
          );
          mergedData[existingKey] = mergedEmp;
          if (!mergedEmp.pnTon && !mergedEmp.phepNam) {
            const prevVal = prevPnTonByMNV[normalizedNewMNV];
            if (prevVal) mergedData[existingKey].pnTon = prevVal;
          }
        }
        duplicateCount++;
      } else {
        let rec = stripAttendanceExcelUploadInternalFields({ ...newEmp });
        if (!hasAttendanceExcelCellValue(rec.gioiTinh)) rec.gioiTinh = "YES";
        if (!rec.pnTon && !rec.phepNam) {
          const prevVal = prevPnTonByMNV[normalizeMNV(rec?.mnv)];
          if (prevVal) rec = { ...rec, pnTon: prevVal };
        }
        mergedData[key] = rec;
        if (normalizedNewMNV) {
          existingKeyByMNV[normalizedNewMNV] = key;
        }
        uploadedCount++;
      }
    });

    const payload = {};
    Object.entries(mergedData).forEach(([k, v]) => {
      payload[k] = stripAttendanceExcelUploadInternalFields(v);
    });
    await set(attendanceRef, payload);

    // Show result message
    let message = `✅ Upload thành công ${uploadedCount} nhân viên mới`;
    if (duplicateCount > 0) {
      message += `, cập nhật ${duplicateCount} nhân viên đã tồn tại`;
    }
    if (skippedResigned > 0) {
      message += t("attendanceList.uploadSkippedResigned", {
        count: skippedResigned,
        defaultValue:
          "; bỏ qua {{count}} dòng (MNV đã nghỉ việc trong hồ sơ employeeProfiles)",
      });
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
