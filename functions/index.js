import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { onValueWritten } from "firebase-functions/v2/database";
import { handleAttendanceEmpAnnualLeaveSync } from "./src/annualLeaveSync/handler.mjs";

initializeApp();

const RTDB_INSTANCE = "pavoassembly-default-rtdb";

/**
 * Khi ghi `attendance/{date}/{empKey}` — server tính delta loại phép và sync phép năm.
 * Client không cần gọi persistAnnualLeave* cho sửa/xóa 1 NV.
 */
export const syncAnnualLeaveOnAttendanceEmpWrite = onValueWritten(
  {
    ref: "/attendance/{dateKey}/{empKey}",
    instance: RTDB_INSTANCE,
    region: "asia-southeast1",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (event) => {
    const db = getDatabase();
    const { dateKey, empKey } = event.params;
    const before = event.data.before.val();
    const after = event.data.after.val();

    try {
      const result = await handleAttendanceEmpAnnualLeaveSync(db, {
        dateKey,
        empKey,
        before,
        after,
      });
      if (result.skipped) {
        console.log("annualLeave sync skipped", { dateKey, empKey, ...result });
        return null;
      }
      console.log("annualLeave sync applied", { dateKey, empKey, ...result });
      return null;
    } catch (error) {
      console.error("annualLeave sync failed", { dateKey, empKey, error });
      throw error;
    }
  },
);
