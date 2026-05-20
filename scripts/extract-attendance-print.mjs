import fs from "fs";

const src = fs.readFileSync(
  "src/features/attendance/AttendanceList.jsx",
  "utf8",
);
// Use git version
import { execSync } from "child_process";
const original = execSync(
  "git show HEAD:src/features/attendance/AttendanceList.jsx",
  { encoding: "utf8" },
);

const lines = original.split(/\r?\n/);

function extractFunction(name) {
  const start = lines.findIndex((l) => l.includes(`const ${name} = useCallback`));
  if (start < 0) throw new Error(`not found ${name}`);
  let depth = 0;
  let end = start;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    depth += (line.match(/\{/g) || []).length;
    depth -= (line.match(/\}/g) || []).length;
    if (i > start && depth === 0 && line.trim() === "});") {
      end = i;
      break;
    }
  }
  return lines.slice(start, end + 1).join("\n");
}

const overtimeBody = extractFunction("handlePrintOvertimeList");
const attendanceBody = extractFunction("handlePrintAttendanceList");

const file = `/**
 * In danh sách điểm danh / tăng ca — tách từ AttendanceList (logic giữ nguyên).
 */
import {
  formatAttendanceLeaveTypeColumnForEmployee,
  formatAttendanceTimeInColumnDisplay,
  getAttendanceLeaveTypePrintStyleAttrForEmployee,
} from "./attendanceGioVaoTypeOptions";

function openPrintWindowOrBlocked() {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return { ok: false, reason: "blocked" };
  return { ok: true, printWindow };
}

export function openAttendanceOvertimePrintWindow({
  filteredEmployees,
  selectedDate,
  displayLocale,
}) {
  const wrapped = { filteredEmployees, selectedDate, displayLocale, setAlert: () => {}, t: (k) => k };
  const fn = ${overtimeBody.replace("handlePrintOvertimeList", "inner")};
  return inner();
}

export function openAttendanceListPrintWindow({
  filteredEmployees,
  selectedDate,
  displayLocale,
}) {
  const fn = ${attendanceBody.replace("handlePrintAttendanceList", "inner")};
  return inner();
}
`;

// Simpler approach: export functions that return result object
console.log("use manual extraction");
