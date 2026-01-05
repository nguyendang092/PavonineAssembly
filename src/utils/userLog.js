import { getDatabase, ref as dbRef, push } from "firebase/database";

export const logUserAction = async (userId, action, details = "") => {
  const db = getDatabase();
  await push(dbRef(db, "logs"), {
    userId,
    action,
    details,
    timestamp: Date.now(),
  });
};

/*
HƯỚNG DẪN SỬ DỤNG:
import { logUserAction } from "./userLog";
await logUserAction(currentUser.email, "add_shift", "Thêm ca mới");
*/
