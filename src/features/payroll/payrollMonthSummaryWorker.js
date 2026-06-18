import { buildMonthlyRuleSummary } from "@/features/payroll/payrollMonthlyRuleSummary";
import { buildChunkByDateFromSerialized } from "@/features/payroll/payrollMonthChunkSerialize";

self.onmessage = (event) => {
  const { jobId, monthKeys, serializedChunks, ids, profilesById } =
    event.data ?? {};
  try {
    const chunkByDate = buildChunkByDateFromSerialized(serializedChunks);
    const results = {};
    for (const id of ids ?? []) {
      results[id] = buildMonthlyRuleSummary(
        chunkByDate,
        monthKeys,
        id,
        profilesById?.[id],
      );
    }
    self.postMessage({ jobId, results });
  } catch (error) {
    self.postMessage({
      jobId,
      error: error?.message || String(error),
    });
  }
};
