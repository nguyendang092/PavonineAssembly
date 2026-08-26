# Cloud Functions — sync phép năm từ điểm danh

## Trigger

`syncAnnualLeaveOnAttendanceEmpWrite`

- Path: `/attendance/{dateKey}/{empKey}`
- Bỏ qua `_meta`
- Tính delta loại phép (before/after)
- Ghi `attendanceLeaveAgg/{year}/{empKey}` (transaction)
- Ghi `annualLeave/{year}/{empKey}` (transaction)

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
firebase deploy --only functions:syncAnnualLeaveOnAttendanceEmpWrite,database
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
npm test -- --run functions/src/annualLeaveSync/handler.test.mjs
```
