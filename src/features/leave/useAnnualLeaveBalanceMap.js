import { useEffect, useState } from "react";
import { db, ref, onValue } from "@/services/firebase";
import { ANNUAL_LEAVE_RTDB_ROOT } from "./annualLeaveFields";
import { buildAnnualLeaveBalanceByMnv } from "./annualLeaveBalanceLookup";

/**
 * RTDB `annualLeave/{year}` → map MNV → BALANCE.
 */
export function useAnnualLeaveBalanceMap(year) {
  const [balanceByMnv, setBalanceByMnv] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const yearRef = ref(db, `${ANNUAL_LEAVE_RTDB_ROOT}/${year}`);
    const unsubscribe = onValue(yearRef, (snapshot) => {
      setBalanceByMnv(buildAnnualLeaveBalanceByMnv(snapshot.val()));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [year]);

  return { balanceByMnv, loading };
}
