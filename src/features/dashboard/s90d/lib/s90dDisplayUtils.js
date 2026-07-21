export function formatShiftLineLabel(shiftSlot) {
  if (!shiftSlot || shiftSlot === "TOTAL" || shiftSlot === "PERCENT") {
    return shiftSlot;
  }
  if (shiftSlot === "00~03") return "00-03";
  return String(shiftSlot).replace(/~/g, "-");
}
export function formatShortDateLabel(dateKey, fallback = "") {
  if (!dateKey || typeof dateKey !== "string") return fallback;
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[2]}/${match[3]}`;
  return fallback || dateKey;
}
