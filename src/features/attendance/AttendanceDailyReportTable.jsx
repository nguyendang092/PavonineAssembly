import { Fragment, memo } from "react";
import {
  formatDailyReportAbsentRate,
  getDailyReportAndonTier,
  getDailyReportProcessMaxAbsentRate,
  getDailyReportRateBarWidth,
  getDailyReportRemarkTags,
} from "./attendanceDailyReportStats";

function SunIcon() {
  return (
    <svg className="adr-shift-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="adr-shift-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function formatShiftHeaderDate(dateKey) {
  if (!dateKey) return "";
  const [y, m, d] = String(dateKey).split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}`;
}

function NumCell({ value, variant = "default", inverted = false, className = "" }) {
  const isZero = value === 0 || value === "0" || value === "";
  const display = value === 0 ? 0 : value || "—";
  return (
    <td
      className={`adr-num adr-num--${variant}${isZero ? " adr-num--zero" : ""}${inverted ? " adr-num--inverted" : ""} ${className}`.trim()}
    >
      {display}
    </td>
  );
}

function AbsentCell({
  absent,
  pendingAttendance = 0,
  pendingLabel,
  inverted = false,
}) {
  const hasAbsent = absent > 0;
  const hasPending = pendingAttendance > 0;
  const isZero = !hasAbsent && !hasPending;

  return (
    <td
      className={`adr-num adr-absent${isZero ? " adr-absent--zero" : ""}${inverted ? " adr-absent--inverted" : ""}`.trim()}
    >
      <div className="adr-absent__stack">
        {hasAbsent ? <span className="adr-absent__count">{absent}</span> : null}
        {hasPending ? (
          <span className="adr-absent__pending">
            {pendingLabel} {pendingAttendance}
          </span>
        ) : null}
        {isZero ? 0 : null}
      </div>
    </td>
  );
}

function AbsentRateCell({ rate, inverted = false }) {
  const display = formatDailyReportAbsentRate(rate);
  if (display === "—") {
    return (
      <td className="adr-num adr-rate">
        <span className="adr-rate-empty">—</span>
      </td>
    );
  }

  const tier = getDailyReportAndonTier(rate);
  const barWidth = getDailyReportRateBarWidth(rate);

  return (
    <td className="adr-num adr-rate">
      <div className={`adr-rate-cell${inverted ? " adr-rate-cell--inverted" : ""}`}>
        <span className={`adr-rate-label adr-rate-label--${tier}`}>{display}</span>
        <div className="adr-rate-track">
          <div
            className={`adr-rate-fill adr-rate-fill--${tier}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
    </td>
  );
}

function RemarksCell({ remarkCounts, locale, inverted = false, dayShift = false }) {
  const tags = getDailyReportRemarkTags(remarkCounts, locale);
  return (
    <td
      className={`adr-remarks${dayShift ? " adr-remarks--day" : ""}${inverted ? " adr-remarks--inverted" : ""}`.trim()}
    >
      {tags.length ? (
        <div className="adr-remark-tags">
          {tags.map(({ key, code, count }) => (
            <span key={key} className="adr-remark-tag">
              {code} {count}
            </span>
          ))}
        </div>
      ) : (
        "—"
      )}
    </td>
  );
}

function ShiftMetricsCells({
  cell,
  pendingLabel,
  locale,
  inverted = false,
  divider = false,
}) {
  return (
    <>
      <NumCell
        value={cell.total}
        variant="total"
        inverted={inverted}
        className={divider ? "adr-col-divider" : ""}
      />
      <AbsentCell
        absent={cell.absent}
        pendingAttendance={cell.pendingAttendance}
        pendingLabel={pendingLabel}
        inverted={inverted}
      />
      <NumCell value={cell.present} variant="present" inverted={inverted} />
      <AbsentRateCell rate={cell.absentRate} inverted={inverted} />
      <RemarksCell
        remarkCounts={cell.remarkCounts}
        locale={locale}
        inverted={inverted}
        dayShift={!divider}
      />
    </>
  );
}

function ProcessCell({ labelKo, labelEn, andonTier, rowSpan, subtotal = false }) {
  return (
    <td className={`adr-process${subtotal ? " adr-process--subtotal" : ""}`} rowSpan={rowSpan}>
      <div className="adr-process__inner">
        {!subtotal ? (
          <span className={`adr-andon adr-andon--${andonTier}`} aria-hidden />
        ) : null}
        <div className="adr-process__text">
          <span className="adr-process__ko">{labelKo}</span>
          <span className="adr-process__en">{labelEn}</span>
        </div>
      </div>
    </td>
  );
}

function ProcessWorkerRow({
  processLabelKo,
  processLabelEn,
  andonTier,
  workerLabel,
  dayCell,
  nightCell,
  pendingLabel,
  locale,
  rowSpan,
  showProcess,
  rowKind = "data",
  seasonal = false,
}) {
  const isSubtotal = rowKind === "subtotal";

  return (
    <tr className={`adr-row adr-row--${rowKind}${seasonal ? " adr-row--seasonal" : ""}`}>
      {showProcess ? (
        <ProcessCell
          labelKo={processLabelKo}
          labelEn={processLabelEn}
          andonTier={andonTier}
          rowSpan={rowSpan}
          subtotal={isSubtotal}
        />
      ) : null}
      <td className={`adr-cat${seasonal ? " adr-cat--seasonal" : ""}`}>{workerLabel}</td>
      <ShiftMetricsCells
        cell={dayCell}
        pendingLabel={pendingLabel}
        locale={locale}
      />
      <ShiftMetricsCells
        cell={nightCell}
        pendingLabel={pendingLabel}
        locale={locale}
        divider
      />
    </tr>
  );
}

function AttendanceDailyReportTable({ rows, summary, dateKey, locale, labels }) {
  const headerDate = formatShiftHeaderDate(dateKey);

  return (
    <div className="adr-panel">
      <div className="adr-table-wrap">
        <table className="adr-table">
          <colgroup>
            <col className="adr-col-group" />
            <col className="adr-col-cat" />
            <col className="adr-col-headcount" />
            <col className="adr-col-absent" />
            <col className="adr-col-present" />
            <col className="adr-col-rate" />
            <col className="adr-col-remarks-day" />
            <col className="adr-col-headcount" />
            <col className="adr-col-absent" />
            <col className="adr-col-present" />
            <col className="adr-col-rate" />
            <col className="adr-col-remarks-night" />
          </colgroup>
          <thead>
            <tr className="adr-thead__main">
              <th colSpan={2} className="adr-th-corner">
                {labels.process} / {labels.category}
              </th>
              <th colSpan={5} className="adr-th-shift adr-th-shift--day">
                <span className="adr-shift-label">
                  <SunIcon />
                  <span>
                    {labels.dayShift}
                    {headerDate ? ` (${headerDate})` : ""}
                  </span>
                </span>
              </th>
              <th colSpan={5} className="adr-th-shift adr-th-shift--night adr-col-divider">
                <span className="adr-shift-label">
                  <MoonIcon />
                  <span>{labels.nightShift}</span>
                </span>
              </th>
            </tr>
            <tr className="adr-thead__sub">
              <th className="adr-th-process">{labels.process}</th>
              <th className="adr-th-worker">{labels.category}</th>
              <ShiftSubHeaders labels={labels} />
              <ShiftSubHeaders labels={labels} divider />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const andonTier = getDailyReportAndonTier(
                getDailyReportProcessMaxAbsentRate(row),
              );
              return (
                <Fragment key={row.processId}>
                  <ProcessWorkerRow
                    processLabelKo={row.labelKo}
                    processLabelEn={row.labelEn}
                    andonTier={andonTier}
                    workerLabel={labels.regularWorker}
                    dayCell={row.regular.day}
                    nightCell={row.regular.night}
                    pendingLabel={labels.pendingShort}
                    locale={locale}
                    rowSpan={2}
                    showProcess
                  />
                  <ProcessWorkerRow
                    workerLabel={labels.dailyWorker}
                    dayCell={row.seasonal.day}
                    nightCell={row.seasonal.night}
                    pendingLabel={labels.pendingShort}
                    locale={locale}
                    showProcess={false}
                    seasonal
                  />
                </Fragment>
              );
            })}

            <ProcessWorkerRow
              processLabelKo={labels.total}
              processLabelEn="TOTAL"
              andonTier="ok"
              workerLabel={labels.regularWorker}
              dayCell={summary.regular.day}
              nightCell={summary.regular.night}
              pendingLabel={labels.pendingShort}
              locale={locale}
              rowSpan={2}
              showProcess
              rowKind="subtotal"
            />
            <ProcessWorkerRow
              workerLabel={labels.dailyWorker}
              dayCell={summary.seasonal.day}
              nightCell={summary.seasonal.night}
              pendingLabel={labels.pendingShort}
              locale={locale}
              showProcess={false}
              rowKind="subtotal"
              seasonal
            />

            <tr className="adr-row adr-row--grand">
              <td colSpan={2} className="adr-grand-label">
                {labels.grandTotal}
              </td>
              <ShiftMetricsCells
                cell={summary.grand.day}
                pendingLabel={labels.pendingShort}
                locale={locale}
                inverted
              />
              <ShiftMetricsCells
                cell={summary.grand.night}
                pendingLabel={labels.pendingShort}
                locale={locale}
                inverted
                divider
              />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ShiftSubHeaders({ labels, divider = false }) {
  return (
    <>
      <th className={`adr-th-metric${divider ? " adr-col-divider" : ""}`}>
        {labels.headcount}
      </th>
      <th className="adr-th-metric">{labels.absence}</th>
      <th className="adr-th-metric">{labels.present}</th>
      <th className="adr-th-metric">{labels.absenceRate}</th>
      <th
        className={`adr-th-metric adr-th-remarks${divider ? "" : " adr-th-remarks--day"}`}
      >
        {labels.remarks}
      </th>
    </>
  );
}

export default memo(AttendanceDailyReportTable);
