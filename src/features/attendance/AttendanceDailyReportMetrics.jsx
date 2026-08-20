import { memo } from "react";
import { formatDailyReportAbsentRate } from "./attendanceDailyReportStats";

function MetricCard({ title, value, detail, warn = false }) {
  return (
    <article className={`adr-metric${warn ? " adr-metric--warn" : ""}`}>
      <p className="adr-metric__title">{title}</p>
      <p className="adr-metric__value">{value}</p>
      {detail ? <p className="adr-metric__detail">{detail}</p> : null}
    </article>
  );
}

function AttendanceDailyReportMetrics({ metrics, labels }) {
  if (!metrics) return null;

  const {
    totalHeadcount,
    regularHeadcount,
    seasonalHeadcount,
    totalPresent,
    dayPresent,
    nightPresent,
    totalAbsent,
    totalPending,
    absenceRate,
    attentionCount,
    attentionLabels,
  } = metrics;

  const attentionDetail =
    attentionCount > 0
      ? attentionLabels.join(" · ")
      : labels.metricsAttentionNone;

  return (
    <section className="adr-metrics" aria-label={labels.metricsAria}>
      <MetricCard
        title={labels.metricsTotalHeadcount}
        value={String(totalHeadcount)}
        detail={labels.metricsHeadcountDetail(regularHeadcount, seasonalHeadcount)}
      />
      <MetricCard
        title={labels.metricsPresent}
        value={`${totalPresent} / ${totalHeadcount}`}
        detail={labels.metricsPresentDetail(dayPresent, nightPresent)}
      />
      <MetricCard
        title={labels.metricsAbsenceRate}
        value={formatDailyReportAbsentRate(absenceRate)}
        detail={labels.metricsAbsenceDetail(totalAbsent, totalPending)}
        warn={
          absenceRate != null &&
          absenceRate >= 5
        }
      />
      <MetricCard
        title={labels.metricsAttention}
        value={String(attentionCount)}
        detail={attentionDetail}
      />
    </section>
  );
}

export default memo(AttendanceDailyReportMetrics);
