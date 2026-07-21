import {
  S90D_DEFECT_COLUMNS,
  S90D_PROCESSES,
  createEmptyDefectCounts,
  sumDefectCounts,
} from "./s90dDefectColumns";
import {
  createEmptyDefectImageUrls,
  defectKeyFromImageField,
  isDefectImageField,
  normalizeDefectImageUrl,
  normalizeDefectImageUrls,
} from "./s90dDefectImages";
import { S90D_SHIFT_SLOTS, resolveShiftSlotKey } from "./s90dShiftSlots";

export const S90D_MANUAL_STORAGE_KEY = "s90d-manual-entries-v1";
export const DEFAULT_PRODUCT_CODE = "S90D";
export const DEFAULT_BOARD_ID = "board-1";

let boardIdCounter = 0;

export function createBoardId() {
  boardIdCounter += 1;
  return `board-${Date.now()}-${boardIdCounter}`;
}

export function createEmptyShiftEntry() {
  return {
    okQty: 0,
    ngQty: 0,
    defects: createEmptyDefectCounts(),
    defectImages: createEmptyDefectImageUrls(),
  };
}

export function createEmptyProcessBoard(
  sequence = 1,
  id = createBoardId(),
  label,
) {
  return {
    id,
    label: label ?? `Bảng ${sequence}`,
    productCode: DEFAULT_PRODUCT_CODE,
    shifts: Object.fromEntries(
      S90D_SHIFT_SLOTS.map((slot) => [slot, createEmptyShiftEntry()]),
    ),
  };
}

export function createEmptyDayProcessEntry() {
  return {
    boards: [createEmptyProcessBoard(1, DEFAULT_BOARD_ID)],
  };
}

export function createEmptyDayEntry() {
  return Object.fromEntries(
    S90D_PROCESSES.map((process) => [process, createEmptyDayProcessEntry()]),
  );
}

function normalizeProcessBoard(rawBoard, sequence = 1) {
  const board = createEmptyProcessBoard(sequence);
  if (!rawBoard || typeof rawBoard !== "object") return board;

  board.id = String(rawBoard.id ?? board.id).trim() || createBoardId();
  board.label =
    String(rawBoard.label ?? board.label).trim() || `Bảng ${sequence}`;
  board.productCode =
    String(rawBoard.productCode ?? DEFAULT_PRODUCT_CODE).trim() ||
    DEFAULT_PRODUCT_CODE;
  board.shifts = normalizeProcessShifts(rawBoard.shifts);
  return board;
}

export function resolveProcessBoards(processEntry) {
  if (!processEntry || typeof processEntry !== "object") {
    return [createEmptyProcessBoard(1, DEFAULT_BOARD_ID)];
  }

  if (Array.isArray(processEntry.boards) && processEntry.boards.length > 0) {
    return processEntry.boards.map((board, index) =>
      normalizeProcessBoard(board, index + 1),
    );
  }

  if (processEntry.shifts || processEntry.productCode !== undefined) {
    return [
      normalizeProcessBoard(
        {
          id: DEFAULT_BOARD_ID,
          label: "Bảng 1",
          productCode: processEntry.productCode,
          shifts: processEntry.shifts,
        },
        1,
      ),
    ];
  }

  return [createEmptyProcessBoard(1, DEFAULT_BOARD_ID)];
}

export function normalizeProcessDayEntry(rawEntry) {
  return {
    boards: resolveProcessBoards(rawEntry),
  };
}

export function normalizeManualStore(raw) {
  if (!raw || typeof raw !== "object") return {};

  const store = {};
  for (const dateKey of Object.keys(raw)) {
    const day = raw[dateKey];
    if (!day || typeof day !== "object") continue;

    store[dateKey] = createEmptyDayEntry();
    for (const process of S90D_PROCESSES) {
      store[dateKey][process] = normalizeProcessDayEntry(day[process]);
    }
  }

  return store;
}

export function parseNonNegativeInt(value) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function syncShiftNgQtyFromDefects(shift) {
  shift.ngQty = sumDefectCounts(shift.defects);
  return shift;
}

function mergeShiftEntryInto(target, source) {
  if (!source || typeof source !== "object") return;

  target.okQty += parseNonNegativeInt(source.okQty);

  S90D_DEFECT_COLUMNS.forEach(({ key }) => {
    target.defects[key] += parseNonNegativeInt(source.defects?.[key]);
    const imageUrl = normalizeDefectImageUrl(source.defectImages?.[key]);
    if (imageUrl && !target.defectImages[key]) {
      target.defectImages[key] = imageUrl;
    }
  });

  syncShiftNgQtyFromDefects(target);
}

function normalizeProcessShifts(rawShifts) {
  const normalized = Object.fromEntries(
    S90D_SHIFT_SLOTS.map((slot) => [slot, createEmptyShiftEntry()]),
  );

  for (const [slot, shift] of Object.entries(rawShifts ?? {})) {
    const targetSlot = resolveShiftSlotKey(slot);
    if (!normalized[targetSlot] || !shift || typeof shift !== "object") continue;
    mergeShiftEntryInto(normalized[targetSlot], shift);
  }

  return normalized;
}

export function loadManualStore() {
  try {
    const raw = window.localStorage.getItem(S90D_MANUAL_STORAGE_KEY);
    if (!raw) return {};
    return normalizeManualStore(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveManualStore(store) {
  window.localStorage.setItem(S90D_MANUAL_STORAGE_KEY, JSON.stringify(store));
}

export function ensureDayEntry(store, dateKey) {
  if (!store[dateKey]) {
    store[dateKey] = createEmptyDayEntry();
  }
  return store[dateKey];
}

export function getDayEntry(store, dateKey) {
  return normalizeManualStore({ [dateKey]: store[dateKey] ?? {} })[dateKey] ??
    createEmptyDayEntry();
}

function findBoardIndex(boards, boardId) {
  return boards.findIndex((board) => board.id === boardId);
}

function cloneProcessDayEntry(processDayEntry) {
  return {
    boards: resolveProcessBoards(processDayEntry).map((board) => ({
      ...board,
      shifts: Object.fromEntries(
        Object.entries(board.shifts).map(([slot, shift]) => [
          slot,
          {
            ...shift,
            defects: { ...shift.defects },
            defectImages: { ...shift.defectImages },
          },
        ]),
      ),
    })),
  };
}

export function getProcessEntry(store, dateKey, process) {
  return (
    getDayEntry(store, dateKey)[process] ?? createEmptyDayProcessEntry()
  );
}

export function getProcessBoard(store, dateKey, process, boardId) {
  const boards = resolveProcessBoards(getProcessEntry(store, dateKey, process));
  return boards.find((board) => board.id === boardId) ?? boards[0];
}

export function updateManualProductCode(
  store,
  dateKey,
  process,
  productCode,
  boardId = DEFAULT_BOARD_ID,
) {
  const next = { ...store };
  const day = { ...ensureDayEntry(next, dateKey) };
  const processDayEntry = cloneProcessDayEntry(day[process]);
  const boardIndex = findBoardIndex(processDayEntry.boards, boardId);
  const targetIndex = boardIndex >= 0 ? boardIndex : 0;

  processDayEntry.boards[targetIndex] = {
    ...processDayEntry.boards[targetIndex],
    productCode: String(productCode ?? "").trim() || DEFAULT_PRODUCT_CODE,
  };

  day[process] = processDayEntry;
  next[dateKey] = day;
  return next;
}

export function updateManualShiftField(
  store,
  dateKey,
  process,
  shiftSlot,
  field,
  value,
  boardId = DEFAULT_BOARD_ID,
) {
  const next = { ...store };
  const day = { ...ensureDayEntry(next, dateKey) };
  const processDayEntry = cloneProcessDayEntry(day[process]);
  const boardIndex = findBoardIndex(processDayEntry.boards, boardId);
  const targetIndex = boardIndex >= 0 ? boardIndex : 0;
  const board = processDayEntry.boards[targetIndex];
  const shift = {
    ...board.shifts[shiftSlot],
    defects: { ...board.shifts[shiftSlot].defects },
    defectImages: { ...board.shifts[shiftSlot].defectImages },
  };

  if (field === "okQty") {
    shift.okQty = parseNonNegativeInt(value);
  } else if (isDefectImageField(field)) {
    const defectKey = defectKeyFromImageField(field);
    if (S90D_DEFECT_COLUMNS.some(({ key }) => key === defectKey)) {
      shift.defectImages[defectKey] = normalizeDefectImageUrl(value);
    }
  } else if (S90D_DEFECT_COLUMNS.some(({ key }) => key === field)) {
    shift.defects[field] = parseNonNegativeInt(value);
    syncShiftNgQtyFromDefects(shift);
  }

  board.shifts[shiftSlot] = shift;
  processDayEntry.boards[targetIndex] = board;
  day[process] = processDayEntry;
  next[dateKey] = day;
  return next;
}

export function ensureProcessBoardAtIndex(processDayEntry, boardIndex) {
  const next = cloneProcessDayEntry(processDayEntry);
  while (next.boards.length < boardIndex) {
    next.boards.push(createEmptyProcessBoard(next.boards.length + 1));
  }
  return next;
}

/** Lấy dữ liệu 1 công đoạn theo các ngày trong tháng (cho form nhập cục bộ). */
export function extractProcessMonthSlice(store, dateKeys, process) {
  return Object.fromEntries(
    dateKeys.map((dateKey) => [
      dateKey,
      getProcessEntry(store, dateKey, process),
    ]),
  );
}

/** Gộp form công đoạn vào store trước khi lưu Firebase. */
export function mergeProcessMonthIntoStore(store, dateKeys, process, localByDate) {
  const next = { ...store };

  dateKeys.forEach((dateKey) => {
    const day = { ...ensureDayEntry(next, dateKey) };
    day[process] = normalizeProcessDayEntry(
      localByDate[dateKey] ?? createEmptyDayProcessEntry(),
    );
    next[dateKey] = day;
  });

  return normalizeManualStore(next);
}

export function updateProcessMonthProductCode(
  localByDate,
  dateKey,
  boardId,
  productCode,
) {
  const processDayEntry = cloneProcessDayEntry(
    localByDate[dateKey] ?? createEmptyDayProcessEntry(),
  );
  const boardIndex = findBoardIndex(processDayEntry.boards, boardId);
  const targetIndex = boardIndex >= 0 ? boardIndex : 0;

  processDayEntry.boards[targetIndex] = {
    ...processDayEntry.boards[targetIndex],
    productCode: String(productCode ?? "").trim() || DEFAULT_PRODUCT_CODE,
  };

  return {
    ...localByDate,
    [dateKey]: processDayEntry,
  };
}

export function updateProcessMonthShiftField(
  localByDate,
  dateKey,
  process,
  boardId,
  shiftSlot,
  field,
  value,
) {
  const fakeStore = {
    [dateKey]: {
      [process]: localByDate[dateKey] ?? createEmptyDayProcessEntry(),
    },
  };
  const updated = updateManualShiftField(
    fakeStore,
    dateKey,
    process,
    shiftSlot,
    field,
    value,
    boardId,
  );

  return {
    ...localByDate,
    [dateKey]: updated[dateKey][process],
  };
}

export function addProcessMonthBoard(localByDate, dateKey, label) {
  const processDayEntry = cloneProcessDayEntry(
    localByDate[dateKey] ?? createEmptyDayProcessEntry(),
  );
  const nextSequence = processDayEntry.boards.length + 1;
  processDayEntry.boards.push(
    createEmptyProcessBoard(nextSequence, createBoardId(), label),
  );

  return {
    ...localByDate,
    [dateKey]: processDayEntry,
  };
}

export function removeProcessMonthBoard(localByDate, dateKey, boardId) {
  const processDayEntry = cloneProcessDayEntry(
    localByDate[dateKey] ?? createEmptyDayProcessEntry(),
  );
  if (processDayEntry.boards.length <= 1) {
    return localByDate;
  }

  processDayEntry.boards = processDayEntry.boards.filter(
    (board) => board.id !== boardId,
  );

  processDayEntry.boards = processDayEntry.boards.map((board, index) => ({
    ...board,
    label: board.label || `Bảng ${index + 1}`,
  }));

  return {
    ...localByDate,
    [dateKey]: processDayEntry,
  };
}

export function boardHasData(board) {
  return Object.values(board?.shifts ?? {}).some(
    (shift) =>
      (shift?.okQty ?? 0) > 0 ||
      S90D_DEFECT_COLUMNS.some(({ key }) => (shift?.defects?.[key] ?? 0) > 0),
  );
}

export function processDayHasData(processDayEntry) {
  return resolveProcessBoards(processDayEntry).some(boardHasData);
}
