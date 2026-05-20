import { execSync } from "child_process";
import fs from "fs";

const lines = execSync(
  "git show HEAD:src/features/attendance/AttendanceList.jsx",
  { encoding: "utf8" },
).split(/\r?\n/);

function sliceCallback(name) {
  const start = lines.findIndex((l) =>
    l.includes(`const ${name} = useCallback(`),
  );
  if (start < 0) throw new Error(name);
  let depth = 0;
  for (let i = start; i < lines.length; i++) {
    depth += (lines[i].match(/\{/g) || []).length;
    depth -= (lines[i].match(/\}/g) || []).length;
    if (i > start && depth === 0 && /^\s*\}\);?\s*$/.test(lines[i])) {
      return lines.slice(start + 1, i).join("\n");
    }
  }
  throw new Error("end not found " + name);
}

const overtimeInner = sliceCallback("handlePrintOvertimeList");
const attendanceInner = sliceCallback("handlePrintAttendanceList");

const header = `/**
 * In danh sách điểm danh / tăng ca — tách từ AttendanceList (logic giữ nguyên).
 */
import {
  formatAttendanceLeaveTypeColumnForEmployee,
  formatAttendanceTimeInColumnDisplay,
  getAttendanceLeaveTypePrintStyleAttrForEmployee,
} from "./attendanceGioVaoTypeOptions";

`;

const overtimeFn = `export function openAttendanceOvertimePrintWindow({
  filteredEmployees,
  selectedDate,
  displayLocale,
}) {
${overtimeInner
  .replace(
    /setAlert\(\{[\s\S]*?printOvertimeOpened[\s\S]*?\}\);\s*\n\s*\}, \[/,
    "return { ok: true };\n}",
  )
  .replace(
    /if \(filteredEmployees\.length === 0\) \{[\s\S]*?return;\s*\}/,
    `if (filteredEmployees.length === 0) {
      return { ok: false, reason: "empty" };
    }`,
  )
  .replace(
    /setAlert\(\{[\s\S]*?printWindowBlocked[\s\S]*?\}\);\s*return;/g,
    "return { ok: false, reason: 'blocked' };",
  )
  .replace(/t\("attendanceList\.noEmployees"\)/g, '""')
  .replace(/}, \[filteredEmployees, selectedDate, displayLocale, t\]\);?/g, "}")
}}

`;

fs.writeFileSync(
  "src/features/attendance/attendanceListPrint.js",
  header + overtimeFn,
);
console.log("written", overtimeFn.length);
