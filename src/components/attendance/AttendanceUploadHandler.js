// AttendanceUploadHandler.js
// This module exports the Excel upload handler for attendance data.
import * as XLSX from "xlsx";
import { ref, set, get } from "firebase/database";

export const handleUploadExcel = async ({
  e,
  user,
  selectedDate,
  setAlert,
  setIsUploadingExcel,
  findNearestPreviousAttendanceData,
  t,
  db,
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

    dataRows.forEach((row, index) => {
      // Kỳ vọng thứ tự cột: STT, MNV, MVT, Họ và tên, Giới tính, Ngày bắt đầu,
      // Mã BP, Bộ phận, Thời gian vào, Thời gian ra, Ca làm việc, Chấm công,
      // ... , PN tồn (ưu tiên cột P nếu có)
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
      const pnTon = getFirstNonEmptyValue(row[12], row[15]);

      // Bỏ qua dòng trống hoàn toàn
      const hasValue = row.some((cell) => String(cell || "").trim() !== "");
      if (!hasValue) return;

      // Chỉ giữ các dòng có MNV là số
      const mnvNum = Number(mnv);
      if (!Number.isFinite(mnvNum) || mnvNum === 0) return;

      const normalizedMNV = normalizeMNV(mnvNum);
      if (!normalizedMNV) return;

      // Trong cùng 1 file, nếu trùng MNV thì lấy dòng xuất hiện sau cùng.
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
        pnTon,
      };
    });

    // Upload to Firebase - Merge with existing data to prevent data loss
    let uploadedCount = 0;
    let duplicateCount = 0;

    // Lấy pnTon từ ngày gần nhất trước selectedDate để carry-forward nếu Excel không có
    const previousResult = await findNearestPreviousAttendanceData(
      selectedDate,
      14,
    );
    const prevData = previousResult?.data || {};
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
        // Update existing employee with new data, chỉ cập nhật gioVao nếu giá trị mới không rỗng
        if (existingKey) {
          const oldEmp = mergedData[existingKey] || {};
          const mergedEmp = { ...oldEmp };
          Object.keys(newEmp).forEach((field) => {
            // Giữ nguyên id cũ theo key Firebase, tránh lệch id và render sai dòng.
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
              // Nếu giá trị mới rỗng, giữ nguyên giá trị cũ
            } else {
              if (newEmp[field] !== undefined && newEmp[field] !== "") {
                mergedEmp[field] = newEmp[field];
              }
            }
          });
          mergedData[existingKey] = mergedEmp;
          // Carry-forward pnTon từ hôm trước nếu hôm nay chưa có
          if (!mergedEmp.pnTon && !mergedEmp.phepNam) {
            const prevVal = prevPnTonByMNV[normalizedNewMNV];
            if (prevVal) mergedData[existingKey].pnTon = prevVal;
          }
        }
        duplicateCount++;
      } else {
        // Add new employee
        // Carry-forward pnTon từ hôm trước nếu Excel không có
        if (!newEmp.pnTon && !newEmp.phepNam) {
          const prevVal = prevPnTonByMNV[normalizeMNV(newEmp?.mnv)];
          if (prevVal) newEmp = { ...newEmp, pnTon: prevVal };
        }
        mergedData[key] = newEmp;
        if (normalizedNewMNV) {
          existingKeyByMNV[normalizedNewMNV] = key;
        }
        uploadedCount++;
      }
    });

    // Save merged data (attendance)
    await set(attendanceRef, mergedData);

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
        error: err?.message || t("attendanceList.uploadCheckFormat"),
      }),
    });
  } finally {
    resetInput();
    setIsUploadingExcel(false);
  }
};
