/**
 * Fingerprint cho cache tổng hợp tháng — gồm số ngày/NV và checksum nội dung
 * (giờ vào/ra, loại phép, cờ ngày…) để không giữ tổng cũ sau khi sửa điểm danh.
 */

function mixFingerprintHash(hash, text) {
  const s = String(text ?? "");
  let h = hash;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

function digestPayrollMonthChunk(ch) {
  if (!ch) return 0;
  let h = mixFingerprintHash(
    0,
    `${ch.isOffDay ? 1 : 0}|${ch.isHolidayDay ? 1 : 0}|${ch.isCompensatoryDay ? 1 : 0}`,
  );
  for (const emp of ch.employees ?? []) {
    h = mixFingerprintHash(
      h,
      [
        emp.id,
        emp.gioVao,
        emp.gioRa,
        emp.loaiPhep,
        emp.caLamViec,
        emp.duocNghiBu,
        emp.tangCaTrua,
        emp.cheDoNhanVien,
      ].join("|"),
    );
  }
  return h;
}

export function computePayrollMonthChunksFingerprint(chunkByDate, monthKeys) {
  const keys = monthKeys ?? [];
  let loadedDays = 0;
  let employeeSlots = 0;
  let contentHash = 0;
  for (const dk of keys) {
    const ch = chunkByDate?.get?.(dk);
    if (!ch) continue;
    loadedDays += 1;
    employeeSlots += ch.employees?.length ?? 0;
    contentHash = mixFingerprintHash(contentHash, digestPayrollMonthChunk(ch));
  }
  return `${keys.length}|${loadedDays}|${employeeSlots}|${contentHash}`;
}
