# Cloud Functions — sync phép năm từ điểm danh

## Trigger

`syncAnnualLeaveOnAttendanceEmpWrite`

- Path: `/attendance/{dateKey}/{empKey}`
- Bỏ qua `_meta`
- Tính delta loại phép (before/after)
- Ghi `attendanceLeaveAgg/{year}/{empKey}` (transaction)
- Ghi `annualLeave/{year}/{empKey}` (transaction)

## Lịch tự động

`scheduledAnnualLeaveRecalculate`

- **00:00 mỗi ngày** (múi giờ `Asia/Ho_Chi_Minh`)
- Rebuild `attendanceLeaveAgg/{năm hiện tại}` từ toàn bộ điểm danh năm đó
- Sync `annualLeave/{năm hiện tại}` cho mọi NV (tương đương nút **Tính lại**)
- Ghi `annualLeave/{year}/_meta.lastScheduledRecalculateAt`

## Client

Sau khi deploy function, client **không** gọi sync phép năm khi:

- Lưu form điểm danh
- Xóa 1 NV / xóa cả ngày
- Upload Excel điểm danh (Firebase `set` → trigger từng `empKey`)

Client **vẫn** gọi `persistAnnualLeaveYearFromAttendance` cho:

- Nút **Tính lại** (Phép năm)
- Upload Excel phép năm HR
- Migration / backfill aggregate (`rebuildLeaveAgg: true`)

## Cài đặt & deploy

```bash
cd functions
npm install
cd ..
firebase deploy --only functions:syncAnnualLeaveOnAttendanceEmpWrite,functions:scheduledAnnualLeaveRecalculate,database
```

## Emulator (dev)

```bash
cd functions && npm install
firebase emulators:start --only functions,database
```

Lưu ý: dev local (`npm run dev`) **không** chạy Cloud Function — phép năm cập nhật qua:

1. **Client fallback** (mặc định): `VITE_CLIENT_ANNUAL_LEAVE_SYNC` ≠ `false` — scoped sync theo ngày/tháng
2. **Cloud Function** khi đã deploy và set `VITE_CLIENT_ANNUAL_LEAVE_SYNC=false`
3. **Emulator**: `firebase emulators:start --only functions,database`

## Tests

```bash
npm test -- --run functions/src/annualLeaveSync/handler.test.mjs functions/src/annualLeaveSync/reconcileYear.test.mjs
```
