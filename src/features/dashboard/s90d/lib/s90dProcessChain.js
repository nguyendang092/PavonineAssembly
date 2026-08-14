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
