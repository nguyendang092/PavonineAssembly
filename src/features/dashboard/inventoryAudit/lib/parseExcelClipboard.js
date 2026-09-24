/** Clipboard Excel: hàng cách nhau bởi xuống dòng, cột bởi tab. */
export function parseExcelClipboardText(text) {
  const raw = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  if (!raw) return [];
  const body = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
  if (!body) return [];
  return body
    .split("\n")
    .map((line) => line.split("\t"))
    .filter((cells) => cells.some((cell) => String(cell ?? "").trim() !== ""));
}

export function isExcelGridClipboard(text) {
  const grid = parseExcelClipboardText(text);
  return grid.length > 1 || (grid.length === 1 && grid[0].length > 1);
}
