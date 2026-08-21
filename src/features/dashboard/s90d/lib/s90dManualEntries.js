import {
  S90D_DEFECT_COLUMNS,
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

import {
  buildS90dEntryBoardSpecs,
  inferCodeSlotFromBoardId,
} from "./s90dEntryBoardSpecs";
import {
  DEFAULT_PRODUCT_CODE,
  ASSEMBLY_PROCESS,
  resolveManualEntryConfig,
  resolveProcessBoardSpecs,
  shouldApplyFixedBoardSpecs,
  S90D_MANUAL_ENTRY_CONFIG,
} from "./s90dManualEntryReportConfig";

export { DEFAULT_PRODUCT_CODE };

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
  productCode = DEFAULT_PRODUCT_CODE,
  codeSlot = null,
  parentBoardId = null,
) {
  const normalizedSlot = codeSlot === "D" || codeSlot === "E" ? codeSlot : null;
  return {
    id,
    label: label ?? `Bảng ${sequence}`,
    productCode: String(productCode ?? DEFAULT_PRODUCT_CODE).trim() || DEFAULT_PRODUCT_CODE,
    codeSlot: normalizedSlot,
    parentBoardId: parentBoardId ?? id,
    shifts: Object.fromEntries(
      S90D_SHIFT_SLOTS.map((slot) => [slot, createEmptyShiftEntry()]),
    ),
  };
}

function createEmptyProcessDayEntryFromSpecs(process, configInput = DEFAULT_PRODUCT_CODE) {
  const config = resolveManualEntryConfig(configInput);
  const specs = buildS90dEntryBoardSpecs(process, config);
  return {
    boards: specs.map((spec, index) =>
      createEmptyProcessBoard(
        index + 1,
        spec.id,
        spec.label,
        spec.productCode,
        spec.codeSlot,
        spec.parentBoardId ?? spec.id,
      ),
    ),
  };
}

export function createEmptyDayProcessEntry() {
  return createEmptyProcessDayEntryFromSpecs("PRESS", DEFAULT_PRODUCT_CODE);
}

export function createEmptyProcessDayEntry(
  process,
  configInput = DEFAULT_PRODUCT_CODE,
) {
  return createEmptyProcessDayEntryFromSpecs(process, configInput);
}

export function createEmptyDayEntry(configInput = DEFAULT_PRODUCT_CODE) {
  const config = resolveManualEntryConfig(configInput);
  return Object.fromEntries(
    config.processes.map((process) => [
      process,
      createEmptyProcessDayEntry(process, config),
    ]),
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
  board.codeSlot =
    rawBoard.codeSlot === "D" || rawBoard.codeSlot === "E"
      ? rawBoard.codeSlot
      : inferCodeSlotFromBoardId(board.id);
  board.parentBoardId =
    String(rawBoard.parentBoardId ?? board.parentBoardId ?? board.id).trim() ||
    board.id;
  board.shifts = normalizeProcessShifts(rawBoard.shifts);
  return board;
}

function cloneBoardShifts(board) {
  return Object.fromEntries(
    Object.entries(board.shifts ?? {}).map(([slot, shift]) => [
      slot,
      {
        ...shift,
        defects: { ...shift.defects },
        defectImages: { ...shift.defectImages },
      },
    ]),
  );
}

function findLegacyBoardForEntrySpec(normalizedBoards, spec, config) {
  const direct = normalizedBoards.find((board) => board.id === spec.id);
  if (direct) return direct;

  const bySlot = normalizedBoards.find(
    (board) =>
      board.codeSlot === spec.codeSlot &&
      (board.parentBoardId === spec.parentBoardId ||
        board.productCode === spec.productCode),
  );
  if (bySlot) return bySlot;

  if (spec.codeSlot !== "D") return null;

  const legacyParent = normalizedBoards.find(
    (board) =>
      board.id === spec.parentBoardId ||
      (!board.codeSlot && matchesBoardSpec(board, { ...spec, id: spec.parentBoardId }, config)),
  );
  if (!legacyParent || legacyParent.codeSlot === "E") return null;
  return legacyParent;
}

function materializeEntryBoard(spec, matchedBoard, index, config) {
  if (matchedBoard) {
    return {
      ...matchedBoard,
      id: spec.id,
      label: spec.label,
      productCode: spec.productCode,
      codeSlot: spec.codeSlot,
      parentBoardId: spec.parentBoardId ?? spec.id,
      shifts:
        matchedBoard.id === spec.id || matchedBoard.codeSlot === spec.codeSlot
          ? matchedBoard.shifts
          : spec.codeSlot === "E"
            ? Object.fromEntries(
                S90D_SHIFT_SLOTS.map((slot) => [slot, createEmptyShiftEntry()]),
              )
            : cloneBoardShifts(matchedBoard),
    };
  }

  return createEmptyProcessBoard(
    index + 1,
    spec.id,
    spec.label,
    spec.productCode,
    spec.codeSlot,
    spec.parentBoardId ?? spec.id,
  );
}

function resolveEntryBoards(rawBoards, process, config) {
  const entrySpecs = buildS90dEntryBoardSpecs(process, config);
  const normalizedBoards =
    rawBoards.length > 0
      ? rawBoards.map((board, index) => normalizeProcessBoard(board, index + 1))
      : [];

  if (!config.usesProductSubCodes) {
    if (shouldApplyFixedBoardSpecs(process, config)) {
      return normalizeFixedBoards(normalizedBoards, config, process);
    }
    return normalizedBoards.length
      ? normalizedBoards
      : createEmptyProcessDayEntryFromSpecs(process, config).boards;
  }

  const claimedIds = new Set();
  return entrySpecs.map((spec, index) => {
    const matched = findLegacyBoardForEntrySpec(
      normalizedBoards.filter((board) => !claimedIds.has(board.id)),
      spec,
      config,
    );
    if (matched) claimedIds.add(matched.id);
    return materializeEntryBoard(spec, matched, index, config);
  });
}

function matchesBoardSpec(board, spec, config) {
  const code = String(board?.productCode ?? "").trim().toUpperCase();
  const label = String(board?.label ?? "").trim().toUpperCase();
  const target = spec.productCode.toUpperCase();

  if (code === target || label === target) return true;

  if (config.fixedBoardSpecsAllProcesses) {
    return code.includes(target) || label.includes(target);
  }

  if (spec.id === "assembly-inzi") {
    return code.includes("INZI") || label.includes("INZI");
  }
  if (spec.id === "assembly-mxc") {
    return code.includes("MXC") || label.includes("MXC");
  }
  return false;
}

function normalizeFixedBoards(rawBoards, config, process) {
  const boardSpecs = resolveProcessBoardSpecs(process, config);
  const boards =
    rawBoards.length > 0
      ? rawBoards.map((board, index) => normalizeProcessBoard(board, index + 1))
      : [];

  const legacySingle =
    boards.length === 1 &&
    String(boards[0].productCode ?? "").trim() === config.defaultProductCode;

  const unmatched = [...boards];

  const takeMatch = (spec) => {
    const index = unmatched.findIndex((board) =>
      matchesBoardSpec(board, spec, config),
    );
    if (index < 0) return null;
    return unmatched.splice(index, 1)[0];
  };

  return boardSpecs.map((spec, index) => {
    const matched = takeMatch(spec);
    if (matched) {
      return {
        ...matched,
        id: spec.id,
        label: spec.label,
        productCode: spec.productCode,
      };
    }

    if (legacySingle && index === 0) {
      return {
        ...boards[0],
        id: spec.id,
        label: spec.label,
        productCode: spec.productCode,
      };
    }

    return createEmptyProcessBoard(
      index + 1,
      spec.id,
      spec.label,
      spec.productCode,
    );
  });
}

function normalizeAssemblyBoards(rawBoards) {
  return normalizeFixedBoards(rawBoards, S90D_MANUAL_ENTRY_CONFIG, ASSEMBLY_PROCESS);
}

function resolveDefaultBoards(process, configInput = DEFAULT_PRODUCT_CODE) {
  return createEmptyProcessDayEntryFromSpecs(process, configInput).boards;
}

export function resolveProcessBoards(
  processEntry,
  process,
  configInput = DEFAULT_PRODUCT_CODE,
) {
  const config = resolveManualEntryConfig(configInput);

  if (!processEntry || typeof processEntry !== "object") {
    return resolveDefaultBoards(process, config);
  }

  let boards = [];

  if (Array.isArray(processEntry.boards) && processEntry.boards.length > 0) {
    boards = processEntry.boards.map((board, index) =>
      normalizeProcessBoard(board, index + 1),
    );
  } else if (processEntry.shifts || processEntry.productCode !== undefined) {
    boards = [
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
  } else {
    return resolveDefaultBoards(process, config);
  }

  return resolveEntryBoards(boards, process, config);
}

export function normalizeProcessDayEntry(
  rawEntry,
  process,
  configInput = DEFAULT_PRODUCT_CODE,
) {
  return {
    boards: resolveProcessBoards(rawEntry, process, configInput),
  };
}

function resolveLegacyProcessDayEntry(day, process) {
  if (process === "MC") {
    if (day?.MC) return day.MC;
    if (day?.GE) return day.GE;
  }
  return day?.[process];
}

export function normalizeManualStore(raw, configInput = DEFAULT_PRODUCT_CODE) {
  const config = resolveManualEntryConfig(configInput);
  if (!raw || typeof raw !== "object") return {};

  const store = {};
  for (const dateKey of Object.keys(raw)) {
    const day = raw[dateKey];
    if (!day || typeof day !== "object") continue;

    store[dateKey] = createEmptyDayEntry(config);
    for (const process of config.processes) {
      store[dateKey][process] = normalizeProcessDayEntry(
        resolveLegacyProcessDayEntry(day, process),
        process,
        config,
      );
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

export function ensureDayEntry(store, dateKey, configInput = DEFAULT_PRODUCT_CODE) {
  if (!store[dateKey]) {
    store[dateKey] = createEmptyDayEntry(configInput);
  }
  return store[dateKey];
}

export function getDayEntry(store, dateKey, configInput = DEFAULT_PRODUCT_CODE) {
  return (
    normalizeManualStore({ [dateKey]: store[dateKey] ?? {} }, configInput)[
      dateKey
    ] ?? createEmptyDayEntry(configInput)
  );
}

function findBoardIndex(boards, boardId) {
  return boards.findIndex((board) => board.id === boardId);
}

function cloneProcessDayEntry(
  processDayEntry,
  process,
  configInput = DEFAULT_PRODUCT_CODE,
) {
  return {
    boards: resolveProcessBoards(processDayEntry, process, configInput).map(
      (board) => ({
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
      }),
    ),
  };
}

export function getProcessEntry(
  store,
  dateKey,
  process,
  configInput = DEFAULT_PRODUCT_CODE,
) {
  return normalizeProcessDayEntry(
    getDayEntry(store, dateKey, configInput)[process],
    process,
    configInput,
  );
}

export function getProcessBoard(store, dateKey, process, boardId) {
  const boards = getProcessEntry(store, dateKey, process).boards;
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
  const processDayEntry = cloneProcessDayEntry(day[process], process);
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
  configInput = DEFAULT_PRODUCT_CODE,
) {
  const config = resolveManualEntryConfig(configInput);
  const next = { ...store };
  const day = { ...ensureDayEntry(next, dateKey, config) };
  const processDayEntry = cloneProcessDayEntry(day[process], process, config);
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

export function ensureProcessBoardAtIndex(
  processDayEntry,
  boardIndex,
  process,
  configInput = DEFAULT_PRODUCT_CODE,
) {
  const config = resolveManualEntryConfig(configInput);
  const next = cloneProcessDayEntry(processDayEntry, process, config);

  if (shouldApplyFixedBoardSpecs(process, config)) {
    return { boards: normalizeFixedBoards(next.boards, config, process) };
  }

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
export function mergeProcessMonthIntoStore(
  store,
  dateKeys,
  process,
  localByDate,
  configInput = DEFAULT_PRODUCT_CODE,
) {
  const config = resolveManualEntryConfig(configInput);
  const next = { ...store };

  dateKeys.forEach((dateKey) => {
    const day = { ...ensureDayEntry(next, dateKey, config) };
    const localDay =
      localByDate[dateKey] ??
      store?.[dateKey]?.[process] ??
      createEmptyProcessDayEntry(process, config);
    day[process] = normalizeProcessDayEntry(localDay, process, config);
    next[dateKey] = day;
  });

  return normalizeManualStore(next, config);
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
  configInput = DEFAULT_PRODUCT_CODE,
) {
  const config = resolveManualEntryConfig(configInput);
  const fakeStore = {
    [dateKey]: {
      [process]:
        localByDate[dateKey] ?? createEmptyProcessDayEntry(process, config),
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
    config,
  );

  return {
    ...localByDate,
    [dateKey]: updated[dateKey][process],
  };
}

export function boardHasData(board) {
  return Object.values(board?.shifts ?? {}).some(
    (shift) =>
      (shift?.okQty ?? 0) > 0 ||
      S90D_DEFECT_COLUMNS.some(({ key }) => (shift?.defects?.[key] ?? 0) > 0),
  );
}

export function processDayHasData(processDayEntry, process, configInput) {
  return resolveProcessBoards(processDayEntry, process, configInput).some(
    boardHasData,
  );
}
