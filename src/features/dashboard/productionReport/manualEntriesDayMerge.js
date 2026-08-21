/**
 * Gộp công đoạn khi xung đột ghi (optimistic lock / transaction).
 * Giữ process khác từ remote; merge board theo id cho process đang lưu.
 */

function cloneBoard(board) {
  return {
    ...board,
    shifts: { ...(board?.shifts ?? {}) },
  };
}

function mergeBoardShifts(remoteBoard, localBoard) {
  const remoteShifts = remoteBoard?.shifts ?? {};
  const localShifts = localBoard?.shifts ?? {};
  const shiftSlots = new Set([
    ...Object.keys(remoteShifts),
    ...Object.keys(localShifts),
  ]);

  /** @type {Record<string, unknown>} */
  const shifts = {};
  for (const slot of shiftSlots) {
    const remoteShift = remoteShifts[slot];
    const localShift = localShifts[slot];
    if (!remoteShift) {
      shifts[slot] = localShift;
      continue;
    }
    if (!localShift) {
      shifts[slot] = remoteShift;
      continue;
    }

    const remoteTs = remoteShift._updatedAt ?? 0;
    const localTs = localShift._updatedAt ?? 0;
    shifts[slot] = localTs >= remoteTs ? localShift : remoteShift;
  }

  return {
    ...remoteBoard,
    ...localBoard,
    shifts,
  };
}

function mergeProcessBoardsOnConflict(remoteProcess, localProcess) {
  const remoteBoards = Array.isArray(remoteProcess?.boards)
    ? remoteProcess.boards
    : [];
  const localBoards = Array.isArray(localProcess?.boards) ? localProcess.boards : [];

  const byId = new Map(remoteBoards.map((board) => [board.id, cloneBoard(board)]));
  for (const localBoard of localBoards) {
    const remoteBoard = byId.get(localBoard.id);
    byId.set(
      localBoard.id,
      remoteBoard
        ? mergeBoardShifts(remoteBoard, localBoard)
        : cloneBoard(localBoard),
    );
  }

  return { boards: Array.from(byId.values()) };
}

/**
 * @param {Record<string, unknown>|null} remoteDay
 * @param {Record<string, unknown>} clientDay
 * @param {string} process
 * @param {Record<string, unknown>} localProcessDay
 */
export function mergeDayEntryOnConflict(remoteDay, clientDay, process, localProcessDay) {
  const remote = remoteDay && typeof remoteDay === "object" ? remoteDay : {};
  const next = { ...remote };

  for (const [key, value] of Object.entries(clientDay ?? {})) {
    if (key === "_updatedAt") continue;
    if (key === process) continue;
    next[key] = value;
  }

  next[process] = mergeProcessBoardsOnConflict(remote[process], localProcessDay);
  return next;
}

/** @param {Record<string, unknown>|null|undefined} day */
export function readDayUpdatedAt(day) {
  const value = day?._updatedAt;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** @param {Record<string, unknown>} day */
export function stampDayUpdatedAt(day, updatedAt = Date.now()) {
  return {
    ...day,
    _updatedAt: updatedAt,
  };
}
