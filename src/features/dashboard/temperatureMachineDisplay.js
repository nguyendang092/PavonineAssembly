/**
 * Tên hiển thị máy (quản lý nhiệt độ) — ưu tiên locale `machineNames`;
 * máy mới chưa khai báo dịch → dùng tên gốc từ Firebase.
 *
 * Không dùng `t(['machineNames', name])` — i18next tách key bằng `.` nên
 * "MC GE" thành `machineNames.MC.GE` và có thể trả về object.
 */
export function getMachineDisplayName(t, machine) {
  const name = String(machine ?? "").trim();
  if (!name) return "";
  const translated = t(name, {
    keyPrefix: "machineNames",
    defaultValue: name,
  });
  return typeof translated === "string" ? translated : name;
}
