/** Gradient ngang cho bar chart tiền chênh lệch (dương / âm). */
export function makeWarehouseInvAmountBarGradient(chart, isNegative) {
  const area = chart?.chartArea;
  if (!area) return isNegative ? "#ef4444" : "#6366f1";
  const ctx = chart.ctx;
  const g = ctx.createLinearGradient(area.left, 0, area.right, 0);
  if (isNegative) {
    g.addColorStop(0, "rgba(252, 165, 165, 0.95)");
    g.addColorStop(0.55, "rgba(239, 68, 68, 0.97)");
    g.addColorStop(1, "rgba(190, 18, 60, 0.98)");
  } else {
    g.addColorStop(0, "rgba(165, 180, 252, 0.95)");
    g.addColorStop(0.55, "rgba(99, 102, 241, 0.97)");
    g.addColorStop(1, "rgba(76, 29, 149, 0.98)");
  }
  return g;
}
