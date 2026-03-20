import React, { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";

const DEPARTMENT_CONFIG = [
  {
    key: "press",
    label: "PRESS",
    aliases: ["press"],
  },
  {
    key: "precision",
    label: "정밀가공",
    aliases: ["mc"],
  },
  {
    key: "hairline",
    label: "헤어라인",
    aliases: ["hairline", "hair line", "헤어라인"],
  },
  {
    key: "anodizing",
    label: "아노다이징",
    aliases: ["anodizing", "ano", "아노다이징"],
  },
  {
    key: "extrusion",
    label: "압출",
    aliases: ["extrusion factory", "압출"],
  },
  {
    key: "assembly",
    label: "조립 ASSY",
    aliases: ["tu", "pmf", "ohf", "komsa", "flip", "deco", "assy-1"],
  },
];

const ABSENT_CODES = new Set([
  "PN",
  "PN1/2",
  "1/2 PN",
  "KL",
  "KP",
  "TS",
  "PO",
  "TN",
  "PC",
  "PT",
  "DS",
]);

const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const isMaternityLeave = (emp) => {
  const gioVao = normalizeText(emp?.gioVao)
    .replace(/["'`’‘.,;:!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return gioVao === "thai sản" || gioVao === "thai san";
};

const isAbsentEmployee = (emp) => {
  const chamCong = normalizeText(emp?.chamCong).toUpperCase();
  const gioVao = String(emp?.gioVao || "").trim();

  if (ABSENT_CODES.has(chamCong)) return true;
  if (!gioVao) return true;
  if (ABSENT_CODES.has(gioVao.toUpperCase())) return true;
  if (!TIME_REGEX.test(gioVao)) return true;

  return false;
};

const isNightShift = (emp) => {
  const caLamViec = normalizeText(emp?.caLamViec);
  if (caLamViec.includes("đêm") || caLamViec.includes("dem")) return true;
  if (caLamViec.includes("night")) return true;

  return false;
};

const buildStats = (records) => {
  const total = records.length;
  const absent = records.filter(isAbsentEmployee).length;
  const present = total - absent;
  const absentRate = total > 0 ? `${Math.round((absent / total) * 100)}%` : "-";

  return {
    total,
    absent,
    present,
    absentRate,
  };
};

const splitShiftStats = (records) => {
  const day = records.filter((emp) => !isNightShift(emp));
  const night = records.filter((emp) => isNightShift(emp));

  return {
    day: buildStats(day),
    night: buildStats(night),
  };
};

const filterByAliases = (employees, aliases) => {
  const aliasSet = new Set(aliases.map((a) => normalizeText(a)));

  return employees.filter((emp) => aliasSet.has(normalizeText(emp?.boPhan)));
};

const SummaryRow = ({
  processLabel,
  required,
  current,
  shortage,
  category,
  dayStats,
  nightStats,
  isMuted,
  editableRequired,
  onRequiredCommit,
  editableNotes,
  dayNote,
  nightNote,
  onDayNoteCommit,
  onNightNoteCommit,
}) => {
  const textClass = isMuted ? "text-slate-400" : "text-slate-800";
  const numberClass = isMuted ? "text-slate-400" : "text-slate-900";
  const [draftRequired, setDraftRequired] = useState(
    required === "" || required === null || required === undefined
      ? ""
      : String(required),
  );
  const [draftDayNote, setDraftDayNote] = useState(dayNote || "");
  const [draftNightNote, setDraftNightNote] = useState(nightNote || "");

  useEffect(() => {
    setDraftRequired(
      required === "" || required === null || required === undefined
        ? ""
        : String(required),
    );
  }, [required]);

  useEffect(() => {
    setDraftDayNote(dayNote || "");
  }, [dayNote]);

  useEffect(() => {
    setDraftNightNote(nightNote || "");
  }, [nightNote]);

  const commitRequired = () => {
    if (!editableRequired || !onRequiredCommit) return;
    const parsed = Number(draftRequired);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraftRequired(String(required || 0));
      return;
    }
    onRequiredCommit(Math.round(parsed));
  };

  const commitDayNote = () => {
    if (!editableNotes || !onDayNoteCommit) return;
    onDayNoteCommit(draftDayNote);
  };

  const commitNightNote = () => {
    if (!editableNotes || !onNightNoteCommit) return;
    onNightNoteCommit(draftNightNote);
  };

  const renderNoteCell = (value, setValue, onCommit, fallbackNote) => {
    if (!editableNotes) {
      return fallbackNote || "-";
    }

    return (
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        placeholder="비고를 입력하세요"
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
    );
  };

  return (
    <tr className={isMuted ? "bg-slate-50" : "bg-white"}>
      <td
        className={`px-3 py-3 border border-slate-300 font-semibold ${textClass}`}
      >
        {processLabel}
      </td>
      <td className="px-3 py-3 border border-slate-300 text-center font-bold bg-amber-100 text-slate-900">
        {editableRequired ? (
          <input
            type="number"
            min="0"
            value={draftRequired}
            onChange={(e) => setDraftRequired(e.target.value)}
            onBlur={commitRequired}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="w-20 text-center rounded border border-amber-300 bg-white px-2 py-1"
          />
        ) : (
          required
        )}
      </td>
      <td
        className={`px-3 py-3 border border-slate-300 text-center font-bold ${numberClass}`}
      >
        {current}
      </td>
      <td
        className={`px-3 py-3 border border-slate-300 text-center font-bold ${
          shortage < 0
            ? "text-red-700 bg-rose-100"
            : "text-emerald-700 bg-emerald-50"
        }`}
      >
        {shortage}
      </td>
      <td
        className={`px-3 py-3 border border-slate-300 font-semibold ${textClass}`}
      >
        {category}
      </td>

      <td
        className={`px-3 py-3 border border-slate-300 text-center font-bold ${numberClass}`}
      >
        {dayStats.total}
      </td>
      <td className="px-3 py-3 border border-slate-300 text-center font-bold text-red-600">
        {dayStats.absent}
      </td>
      <td
        className={`px-3 py-3 border border-slate-300 text-center font-bold ${numberClass}`}
      >
        {dayStats.present}
      </td>
      <td className="px-3 py-3 border border-slate-300 text-center font-bold text-red-600">
        {dayStats.absentRate}
      </td>
      <td
        className={`px-3 py-3 border border-slate-300 text-left ${textClass}`}
      >
        {renderNoteCell(draftDayNote, setDraftDayNote, commitDayNote, dayNote)}
      </td>

      <td
        className={`px-3 py-3 border border-slate-300 text-center font-bold ${numberClass}`}
      >
        {nightStats.total}
      </td>
      <td className="px-3 py-3 border border-slate-300 text-center font-bold text-red-600">
        {nightStats.absent}
      </td>
      <td
        className={`px-3 py-3 border border-slate-300 text-center font-bold ${numberClass}`}
      >
        {nightStats.present}
      </td>
      <td className="px-3 py-3 border border-slate-300 text-center font-bold text-red-600">
        {nightStats.absentRate}
      </td>
      <td
        className={`px-3 py-3 border border-slate-300 text-left ${textClass}`}
      >
        {renderNoteCell(
          draftNightNote,
          setDraftNightNote,
          commitNightNote,
          nightNote,
        )}
      </td>
    </tr>
  );
};

function AttendanceHeadcountDashboard({
  employees,
  seasonalEmployees,
  requiredByDepartment,
  onRequiredChange,
  notesByKey,
  onNoteChange,
  canEditRequired,
  selectedDate,
  setSelectedDate,
  loading,
}) {
  const dashboardExportRef = useRef(null);

  const handleDownloadDashboardImage = () => {
    const node = dashboardExportRef.current;
    if (!node) return;

    toPng(node, {
      backgroundColor: "#ffffff",
      pixelRatio: Math.max(2, window.devicePixelRatio || 1),
      cacheBust: true,
    })
      .then((dataUrl) => {
        const a = document.createElement("a");
        const fallbackDate = new Date();
        const yyyy = fallbackDate.getFullYear();
        const mm = String(fallbackDate.getMonth() + 1).padStart(2, "0");
        const dd = String(fallbackDate.getDate()).padStart(2, "0");
        const fileDate = selectedDate || `${yyyy}-${mm}-${dd}`;
        a.download = `attendance-dashboard-${fileDate}.png`;
        a.href = dataUrl;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((error) => {
        console.error("Download dashboard image failed:", error);
      });
  };

  const filteredRegular = useMemo(() => {
    return Array.isArray(employees) ? employees : [];
  }, [employees]);

  const filteredSeasonal = useMemo(() => {
    return Array.isArray(seasonalEmployees) ? seasonalEmployees : [];
  }, [seasonalEmployees]);

  const rows = useMemo(() => {
    return DEPARTMENT_CONFIG.map((dept) => {
      const regular = filterByAliases(filteredRegular, dept.aliases).filter(
        (emp) => !isMaternityLeave(emp),
      );
      const seasonal = filterByAliases(filteredSeasonal, dept.aliases).filter(
        (emp) => !isMaternityLeave(emp),
      );
      const current = regular.length + seasonal.length;
      const requiredInput = Number(requiredByDepartment?.[dept.key]);
      const required =
        Number.isFinite(requiredInput) && requiredInput >= 0
          ? requiredInput
          : current;

      const regularStats =
        dept.key === "extrusion"
          ? {
              day: buildStats(regular),
              night: buildStats([]),
            }
          : splitShiftStats(regular);

      const seasonalStats =
        dept.key === "extrusion"
          ? {
              day: buildStats(seasonal),
              night: buildStats([]),
            }
          : splitShiftStats(seasonal);

      return {
        ...dept,
        required,
        current,
        shortage: current - required,
        regularStats,
        seasonalStats,
      };
    });
  }, [filteredRegular, filteredSeasonal, requiredByDepartment]);

  const totals = useMemo(() => {
    const empty = {
      total: 0,
      absent: 0,
      present: 0,
      absentRate: "-",
    };

    const sumStats = (list, accessor) => {
      const merged = list.reduce(
        (acc, item) => {
          const stats = accessor(item);
          return {
            total: acc.total + stats.total,
            absent: acc.absent + stats.absent,
            present: acc.present + stats.present,
          };
        },
        { total: 0, absent: 0, present: 0 },
      );

      return {
        ...merged,
        absentRate:
          merged.total > 0
            ? `${Math.round((merged.absent / merged.total) * 100)}%`
            : "-",
      };
    };

    const required = rows.reduce((sum, item) => sum + item.required, 0);
    const current = rows.reduce((sum, item) => sum + item.current, 0);

    return {
      required,
      current,
      shortage: current - required,
      regular: {
        day: sumStats(rows, (r) => r.regularStats.day),
        night: sumStats(rows, (r) => r.regularStats.night),
      },
      seasonal: {
        day: sumStats(rows, (r) => r.seasonalStats.day),
        night: sumStats(rows, (r) => r.seasonalStats.night),
      },
      grand: {
        day: sumStats(rows, (r) => {
          const dayTotal = r.regularStats.day.total + r.seasonalStats.day.total;
          const absent = r.regularStats.day.absent + r.seasonalStats.day.absent;
          return {
            ...empty,
            total: dayTotal,
            absent,
            present: dayTotal - absent,
          };
        }),
        night: sumStats(rows, (r) => {
          const nightTotal =
            r.regularStats.night.total + r.seasonalStats.night.total;
          const absent =
            r.regularStats.night.absent + r.seasonalStats.night.absent;
          return {
            ...empty,
            total: nightTotal,
            absent,
            present: nightTotal - absent,
          };
        }),
      },
    };
  }, [rows]);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div
        ref={dashboardExportRef}
        className="max-w-[1800px] mx-auto space-y-4"
      >
        <div className="bg-white rounded-lg shadow border border-slate-200 p-4 md:p-5">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
                인원 현황
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                공정별 인력 현황을 추적하고 정규직과 일용직을 구분합니다
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Ngày
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={handleDownloadDashboardImage}
                className="px-3 py-2 rounded-md text-sm font-semibold border bg-slate-900 border-slate-900 text-white hover:bg-slate-700 transition"
              >
                Tải hình PNG
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-600">
              Đang tải dữ liệu...
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-[1600px] w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#d9e2d3] text-slate-900">
                    <th
                      rowSpan={2}
                      className="px-3 py-3 border border-slate-400 min-w-[130px]"
                    >
                      공정
                    </th>
                    <th
                      rowSpan={2}
                      className="px-3 py-3 border border-slate-400 min-w-[95px]"
                    >
                      총 필요인원
                    </th>
                    <th
                      rowSpan={2}
                      className="px-3 py-3 border border-slate-400 min-w-[90px]"
                    >
                      현재 인원
                    </th>
                    <th
                      rowSpan={2}
                      className="px-3 py-3 border border-slate-400 min-w-[90px]"
                    >
                      부족 인원
                    </th>
                    <th
                      rowSpan={2}
                      className="px-3 py-3 border border-slate-400 min-w-[90px]"
                    >
                      구분
                    </th>
                    <th
                      colSpan={5}
                      className="px-3 py-3 border border-slate-400 min-w-[540px]"
                    >
                      주간 근무
                    </th>
                    <th
                      colSpan={5}
                      className="px-3 py-3 border border-slate-400 min-w-[540px]"
                    >
                      야간 근무
                    </th>
                  </tr>
                  <tr className="bg-[#d9e2d3] text-slate-900">
                    <th className="px-3 py-2 border border-slate-400 min-w-[70px]">
                      인원
                    </th>
                    <th className="px-3 py-2 border border-slate-400 min-w-[80px]">
                      결근/연차
                    </th>
                    <th className="px-3 py-2 border border-slate-400 min-w-[80px]">
                      출근 인원
                    </th>
                    <th className="px-3 py-2 border border-slate-400 min-w-[80px]">
                      결근율
                    </th>
                    <th className="px-3 py-2 border border-slate-400 min-w-[200px]">
                      비고
                    </th>
                    <th className="px-3 py-2 border border-slate-400 min-w-[70px]">
                      인원
                    </th>
                    <th className="px-3 py-2 border border-slate-400 min-w-[80px]">
                      결근/연차
                    </th>
                    <th className="px-3 py-2 border border-slate-400 min-w-[80px]">
                      출근 인원
                    </th>
                    <th className="px-3 py-2 border border-slate-400 min-w-[80px]">
                      결근율
                    </th>
                    <th className="px-3 py-2 border border-slate-400 min-w-[200px]">
                      비고
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <React.Fragment key={row.key}>
                      <SummaryRow
                        processLabel={row.label}
                        required={row.required}
                        current={row.current}
                        shortage={row.shortage}
                        category="정규직"
                        dayStats={row.regularStats.day}
                        nightStats={row.regularStats.night}
                        isMuted={false}
                        editableRequired={canEditRequired}
                        onRequiredCommit={(value) =>
                          onRequiredChange?.(row.key, value)
                        }
                        editableNotes={canEditRequired}
                        dayNote={notesByKey?.[`${row.key}_regular_day`] || ""}
                        nightNote={
                          notesByKey?.[`${row.key}_regular_night`] || ""
                        }
                        onDayNoteCommit={(value) =>
                          onNoteChange?.(`${row.key}_regular_day`, value)
                        }
                        onNightNoteCommit={(value) =>
                          onNoteChange?.(`${row.key}_regular_night`, value)
                        }
                      />
                      <SummaryRow
                        processLabel=""
                        required=""
                        current=""
                        shortage=""
                        category="일용직"
                        dayStats={row.seasonalStats.day}
                        nightStats={row.seasonalStats.night}
                        isMuted={true}
                        editableNotes={canEditRequired}
                        dayNote={notesByKey?.[`${row.key}_seasonal_day`] || ""}
                        nightNote={
                          notesByKey?.[`${row.key}_seasonal_night`] || ""
                        }
                        onDayNoteCommit={(value) =>
                          onNoteChange?.(`${row.key}_seasonal_day`, value)
                        }
                        onNightNoteCommit={(value) =>
                          onNoteChange?.(`${row.key}_seasonal_night`, value)
                        }
                      />
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <SummaryRow
                    processLabel="TOTAL"
                    required={totals.required}
                    current={totals.current}
                    shortage={totals.shortage}
                    category="정규직"
                    dayStats={totals.regular.day}
                    nightStats={totals.regular.night}
                    isMuted={false}
                  />
                  <SummaryRow
                    processLabel=""
                    required=""
                    current=""
                    shortage=""
                    category="일용직"
                    dayStats={totals.seasonal.day}
                    nightStats={totals.seasonal.night}
                    isMuted={true}
                  />
                  <tr className="bg-blue-900 text-white font-bold">
                    <td className="px-3 py-3 border border-blue-950">TOTAL</td>
                    <td className="px-3 py-3 border border-blue-950 text-center">
                      {totals.required}
                    </td>
                    <td className="px-3 py-3 border border-blue-950 text-center">
                      {totals.current}
                    </td>
                    <td className="px-3 py-3 border border-blue-950 text-center">
                      {totals.shortage}
                    </td>
                    <td className="px-3 py-3 border border-blue-950">합계</td>
                    <td className="px-3 py-3 border border-blue-950 text-center">
                      {totals.grand.day.total}
                    </td>
                    <td className="px-3 py-3 border border-blue-950 text-center text-red-200">
                      {totals.grand.day.absent}
                    </td>
                    <td className="px-3 py-3 border border-blue-950 text-center">
                      {totals.grand.day.present}
                    </td>
                    <td className="px-3 py-3 border border-blue-950 text-center text-red-200">
                      {totals.grand.day.absentRate}
                    </td>
                    <td className="px-3 py-3 border border-blue-950 text-center">
                      -
                    </td>
                    <td className="px-3 py-3 border border-blue-950 text-center">
                      {totals.grand.night.total}
                    </td>
                    <td className="px-3 py-3 border border-blue-950 text-center text-red-200">
                      {totals.grand.night.absent}
                    </td>
                    <td className="px-3 py-3 border border-blue-950 text-center">
                      {totals.grand.night.present}
                    </td>
                    <td className="px-3 py-3 border border-blue-950 text-center text-red-200">
                      {totals.grand.night.absentRate}
                    </td>
                    <td className="px-3 py-3 border border-blue-950 text-center">
                      -
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AttendanceHeadcountDashboard;
