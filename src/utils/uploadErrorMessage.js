/**
 * Chuẩn hóa thông báo lỗi upload Excel → Firebase RTDB (hữu ích khi local OK nhưng deploy lỗi).
 */
export function getUploadErrorMessage(err, formatFallback) {
  const code = String(err?.code || "");
  const msg = String(err?.message || "");

  if (code === "PERMISSION_DENIED" || /permission_denied/i.test(msg)) {
    return (
      "Không có quyền ghi (PERMISSION_DENIED). Đăng xuất và đăng nhập lại bằng tài khoản Firebase; " +
      "trong Firebase Console → Authentication → Settings → Authorized domains: thêm domain trang deploy; " +
      "và kiểm tra Realtime Database → Rules cho phép user đã đăng nhập ghi nhánh attendance."
    );
  }

  if (
    code === "UNAVAILABLE" ||
    code === "deadline-exceeded" ||
    /network|Failed to fetch|ERR_NETWORK/i.test(msg)
  ) {
    return "Lỗi mạng hoặc dịch vụ tạm thời không phản hồi. Thử lại sau.";
  }

  if (msg) return msg;
  return formatFallback || "Lỗi không xác định";
}
