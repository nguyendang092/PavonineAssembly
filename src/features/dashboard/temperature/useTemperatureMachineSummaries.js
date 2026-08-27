import { useEffect, useMemo, useState } from "react";
import { get, ref } from "firebase/database";
import { db } from "@/services/firebase";
import { summarizeMachineMonth } from "./temperatureMonitorUtils";

/**
 * Tóm tắt nhanh từng máy (badge nav) — tải song song theo tháng.
 */
export function useTemperatureMachineSummaries(area, selectedMonth, machines) {
  const [summariesByMachine, setSummariesByMachine] = useState({});
  const machineKey = machines.join("|");

  useEffect(() => {
    if (!area || !selectedMonth || machines.length === 0) {
      setSummariesByMachine({});
      return;
    }

    let cancelled = false;

    (async () => {
      const entries = await Promise.all(
        machines.map(async (machine) => {
          try {
            const snap = await get(
              ref(
                db,
                `temperature_monitor/${area}/${machine}/${selectedMonth}`,
              ),
            );
            const data = snap.val() ?? { temperature: {}, humidity: {} };
            return [machine, summarizeMachineMonth(data, selectedMonth)];
          } catch {
            return [machine, { filled: 0, alerts: 0, alertRows: [] }];
          }
        }),
      );

      if (cancelled) return;
      setSummariesByMachine(Object.fromEntries(entries));
    })();

    return () => {
      cancelled = true;
    };
  }, [area, selectedMonth, machineKey, machines]);

  return useMemo(() => summariesByMachine, [summariesByMachine]);
}
