export const S90D_CELL_INPUT_SELECTOR =
  "input.s90d-cell-input:not([disabled])";

const ARROW_DIRECTION = Object.freeze({
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
});

export function findNeighborNavCell(cells, currentId, direction) {
  if (!Array.isArray(cells) || !cells.length || !direction) return null;
  const index = cells.findIndex((cell) => cell.id === currentId);
  if (index < 0) return null;

  if (direction === "left") return cells[index - 1] ?? null;
  if (direction === "right") return cells[index + 1] ?? null;

  const current = cells[index];
  const sameCol = cells.filter((cell) => cell.col === current.col);
  const colIndex = sameCol.findIndex((cell) => cell.id === currentId);
  const nextIndex = direction === "down" ? colIndex + 1 : colIndex - 1;
  return sameCol[nextIndex] ?? null;
}

export function collectInputNavCells(root) {
  if (!root?.querySelectorAll) return [];
  return Array.from(root.querySelectorAll(S90D_CELL_INPUT_SELECTOR)).filter(
    (el) =>
      !el.hidden &&
      el.getAttribute("aria-hidden") !== "true" &&
      el.closest("[hidden]") == null,
  );
}

export function describeNavCell(el) {
  const td = el?.closest?.("td, th");
  return {
    id: el,
    col: td?.cellIndex ?? 0,
  };
}

export function focusNavCell(el) {
  if (!el || typeof el.focus !== "function") return;
  el.focus();
  if (typeof el.select === "function") {
    try {
      el.select();
    } catch {
      // type=number may not support select()
    }
  }
  if (typeof el.scrollIntoView === "function") {
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

export function tryNavigateS90dInputCell(event, root) {
  if (!event || event.defaultPrevented) return false;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return false;
  }

  const direction = ARROW_DIRECTION[event.key];
  if (!direction) return false;

  const current = event.target;
  if (
    !(current instanceof HTMLInputElement) ||
    !current.classList.contains("s90d-cell-input") ||
    current.disabled
  ) {
    return false;
  }
  if (root && typeof root.contains === "function" && !root.contains(current)) {
    return false;
  }

  event.preventDefault();

  const cells = collectInputNavCells(root ?? current.closest("table") ?? current);
  const described = cells.map(describeNavCell);
  const next = findNeighborNavCell(described, current, direction);
  if (next?.id && next.id !== current) {
    focusNavCell(next.id);
  }
  return true;
}
