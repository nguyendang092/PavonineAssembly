import * as XLSX from "@e965/xlsx";
import { ref, update } from "firebase/database";

function sanitizeKey(key) {
  return key?.toString().replace(/[.#$/\[\]]/g, "_") || "unknown";
}

/**
 * Đọc file Excel NG (FaultyQuantity, OrganizationName, …) và ghi lên Firebase `ng/...`.
 */
export function uploadNgFaultyExcel(file, { db, user, logUserAction, onLoading }) {
  if (!file) {
    alert("Vui lòng chọn file Excel!");
    return Promise.resolve();
  }
  onLoading?.(true);
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        if (
          !jsonData[0]?.OrganizationName ||
          !jsonData[0]?.WEEK ||
          !jsonData[0]?.ReworkOrNot ||
          !jsonData[0]?.time_monthday ||
          !jsonData[0]?.ItemCode ||
          typeof jsonData[0]?.FaultyQuantity === "undefined"
        ) {
          alert("File Excel thiếu cột hoặc sai định dạng!");
          resolve();
          return;
        }
        const updates = {};
        jsonData.forEach((row) => {
          const workplace = sanitizeKey(row.OrganizationName);
          const week = sanitizeKey(row.WEEK);
          const rework = sanitizeKey(row.ReworkOrNot);
          let day = sanitizeKey(row.time_monthday);
          if (/^[A-Za-z]{3} \d{2} $/.test(day)) {
            const [monthStr, dayStr] = day.trim().split(" ");
            const month =
              [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
              ].indexOf(monthStr) + 1;
            const year = new Date().getFullYear();
            day = `${year}-${month
              .toString()
              .padStart(2, "0")}-${dayStr.padStart(2, "0")}`;
          }
          const model = sanitizeKey(row.ItemCode);
          const quantity = row.FaultyQuantity || 0;
          const reason = row.FaultyItemName || "";
          const path = `ng/${workplace}/${week}/${rework}/${day}/${model}/Day`;
          updates[path] = { quantity, reason };
        });
        if (user && user.email) {
          await logUserAction(
            user.email,
            "upload_faulty_data",
            "Upload từ file Excel lỗi",
          );
        }
        await update(ref(db), updates);
        alert("Upload thành công!");
        resolve();
      } catch (err) {
        console.error("Lỗi xử lý file:", err);
        alert("Lỗi xử lý file Excel: " + err.message);
        reject(err);
      } finally {
        onLoading?.(false);
      }
    };
    reader.onerror = () => {
      onLoading?.(false);
      reject(new Error("Không đọc được file"));
    };
    reader.readAsBinaryString(file);
  });
}
