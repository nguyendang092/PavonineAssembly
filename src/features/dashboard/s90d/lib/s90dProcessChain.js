export function normalizeProductCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function findBoardRowForProduct(detail, productCode) {
  const code = normalizeProductCode(productCode);
  if (!code || !detail?.boardRows?.length) return null;

  return (
    detail.boardRows.find(
      (row) =>
        normalizeProductCode(row.productCode ?? row.label) === code,
    ) ?? null
  );
}

function mergeBoardRowTotals(rows) {
  const merged = {
    productCode: rows[0]?.productCode ?? "",
    label: rows[0]?.label ?? "",
    totalQty: 0,
    okQty: 0,
    ngQty: 0,
    defects: {},
    defectTotal: 0,
    defectImages: {},
  };

  for (const row of rows) {
    merged.totalQty += row.totalQty ?? 0;
    merged.okQty += row.okQty ?? 0;
    merged.ngQty += row.ngQty ?? 0;
    merged.defectTotal += row.defectTotal ?? 0;

    for (const [key, value] of Object.entries(row.defects ?? {})) {
      merged.defects[key] = (merged.defects[key] ?? 0) + (value ?? 0);
    }

    for (const [key, value] of Object.entries(row.defectImages ?? {})) {
      const list = Array.isArray(value) ? value : value ? [value] : [];
      merged.defectImages[key] = [
        ...(merged.defectImages[key] ?? []),
        ...list,
      ];
    }
  }

  if (merged.totalQty > 0) {
    merged.yieldPct = Math.round((merged.okQty / merged.totalQty) * 1000) / 10;
    merged.ngRatePct = Math.round((merged.ngQty / merged.totalQty) * 1000) / 10;
  } else {
    merged.yieldPct = null;
    merged.ngRatePct = null;
  }

  return merged;
}

/** Gộp mọi bảng cùng mã hàng (vd. MC có 2 bảng AP5FL). */
export function findMergedBoardRowForProduct(detail, productCode) {
  const code = normalizeProductCode(productCode);
  if (!code || !detail?.boardRows?.length) return null;

  const matches = detail.boardRows.filter(
    (row) => normalizeProductCode(row.productCode ?? row.label) === code,
  );
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];
  return mergeBoardRowTotals(matches);
}

export function isS90dProcessChainComplete(processRows, processes) {
  return (processes ?? []).every((process) => {
    const row = (processRows ?? []).find((item) => item.process === process);
    return (row?.totalQty ?? 0) > 0;
  });
}

export function isProductProcessChainComplete(stageRows, processes) {
  return (processes ?? []).every((process) => {
    const row = (stageRows ?? []).find((item) => item.process === process);
    return (row?.totalQty ?? 0) > 0;
  });
}

/** Từ công đoạn thiếu SL trở đi: không hiển thị hiệu suất / tích lũy. */
export function applyBrokenChainYieldInvalidation(processRows, processes) {
  let chainBroken = false;

  (processes ?? []).forEach((process) => {
    const row = (processRows ?? []).find((item) => item.process === process);
    if (!row) return;

    if ((row.totalQty ?? 0) <= 0) {
      chainBroken = true;
    }

    if (chainBroken) {
      row.yieldPct = null;
      row.cumulativeYieldPct = null;
      if ((row.totalQty ?? 0) <= 0) {
        row.ngRatePct = null;
      }
    }
  });
}

export function applyBrokenChainBoardYieldInvalidation(processDetails, processes) {
  const productCodes = new Set();

  (processDetails ?? []).forEach((detail) => {
    detail.boardRows?.forEach((boardRow) => {
      const code = normalizeProductCode(boardRow.productCode ?? boardRow.label);
      if (code) productCodes.add(code);
    });
  });

  productCodes.forEach((code) => {
    let chainBroken = false;

    (processes ?? []).forEach((process) => {
      const detail = processDetails.find((item) => item.process === process);
      const boardRow = findBoardRowForProduct(detail, code);
      const totalQty = boardRow?.totalQty ?? 0;

      if (totalQty <= 0) {
        chainBroken = true;
      }

      if (chainBroken && boardRow) {
        boardRow.yieldPct = null;
        if (totalQty <= 0) {
          boardRow.ngRatePct = null;
        }
      }
    });
  });
}
