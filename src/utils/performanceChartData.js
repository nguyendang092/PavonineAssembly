/**
 * Dữ liệu & công thức cho màn Performance / 개선 제안 — dùng chung test & UI.
 */

const TEAM_NAMES = [
  "PRESS",
  "MC",
  "HAIRLINE",
  "ANODIZING",
  "ASSEMBLY",
  "QC",
  "지원부서",
];

/** Từ 2026 bỏ QC và 지원부서 */
export function getTeamNamesForYear(year) {
  if (year >= 2026) {
    return TEAM_NAMES.filter((team) => team !== "QC" && team !== "지원부서");
  }
  return [...TEAM_NAMES];
}

export function emptyWeeksObject() {
  const weeks = {};
  for (let i = 1; i <= 53; i++) {
    weeks[`W${i}`] = 0;
  }
  return weeks;
}

export function createTeamTemplate(teamName = "") {
  return {
    team: teamName,
    target: 0,
    weeks: emptyWeeksObject(),
  };
}

/** Hàng mặc định theo năm (đủ team sau khi lọc). */
function buildFilteredTemplate(year) {
  return getTeamNamesForYear(year).map((name) => createTeamTemplate(name));
}

/**
 * Tuần hiện tại trong năm `year` (1–53).
 * Năm quá khứ → 53, năm tương lai → 1.
 */
export function getCurrentWeek(year) {
  const now = new Date();
  const targetYear = year ?? now.getFullYear();

  if (targetYear === now.getFullYear()) {
    const startOfYear = new Date(targetYear, 0, 1);
    const pastDaysOfYear = (now - startOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
  }

  if (targetYear < now.getFullYear()) return 53;
  return 1;
}

export function calculateTotal(teamData, upToWeek) {
  let total = 0;
  for (let i = 1; i < upToWeek; i++) {
    total += teamData.weeks[`W${i}`] || 0;
  }
  return total;
}

export function calculatePercentage(total, target) {
  if (target === 0) return 0;
  return ((total / target) * 100).toFixed(1);
}

/** Team mặc định trước, sau đó team thêm (theo thứ tự xuất hiện trong DB). */
function orderedTeamNames(year, teamsFromDb) {
  const base = getTeamNamesForYear(year);
  const baseSet = new Set(base);
  const extras = [];
  const seen = new Set(base);
  for (const t of teamsFromDb) {
    const name = String(t ?? "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    if (!baseSet.has(name)) extras.push(name);
  }
  return [...base, ...extras];
}

/**
 * Chuẩn hoá một năm từ Firebase: cấu trúc mới (weeks) hoặc legacy (currentWeek).
 * Team không thuộc danh sách mặc định (do admin thêm) được giữ nguyên.
 */
export function deriveRowsForYear(year, yearData) {
  if (!yearData || !Array.isArray(yearData) || yearData.length === 0) {
    return buildFilteredTemplate(year);
  }

  const base = getTeamNamesForYear(year);

  if (yearData[0]?.weeks) {
    const byTeam = new Map(yearData.map((r) => [r.team, r]));
    const names = orderedTeamNames(year, yearData.map((r) => r.team));
    return names.map((name) => {
      const row = byTeam.get(name);
      if (row) return { ...row, team: name };
      return createTeamTemplate(name);
    });
  }

  const weekNum = getCurrentWeek(year);
  const converted = yearData.map((item) => {
    const weeks = emptyWeeksObject();
    if (item.currentWeek && weekNum > 1) {
      weeks[`W${weekNum - 1}`] = item.currentWeek || 0;
    }
    return {
      team: item.team,
      target: item.target || 0,
      weeks,
    };
  });

  return converted.filter((item) => base.includes(item.team));
}

/** Kiểm tra tên team hợp lệ (không trùng, không trùng team mặc định). */
export function canAddTeamName(year, name, existingRows) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  const base = getTeamNamesForYear(year);
  if (base.includes(trimmed)) return { ok: false, reason: "base" };
  const used = new Set(existingRows.map((r) => String(r.team ?? "").trim()));
  if (used.has(trimmed)) return { ok: false, reason: "duplicate" };
  return { ok: true, name: trimmed };
}

/** Chỉ team thêm (không thuộc danh sách mặc định năm đó) mới được xóa khỏi bảng. */
export function isRemovableTeam(year, teamName) {
  const base = getTeamNamesForYear(year);
  return !base.includes(String(teamName ?? "").trim());
}
