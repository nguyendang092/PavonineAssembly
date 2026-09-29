export function signedDeltaClass(n) {
  if (!Number.isFinite(n) || Math.abs(n) < 1e-9) {
    return "wah-inv-delta wah-inv-delta--flat";
  }
  return n > 0
    ? "wah-inv-delta wah-inv-delta--up"
    : "wah-inv-delta wah-inv-delta--down";
}

export function formatPlainQty(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 4 });
}

export function formatSignedQty(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) < 1e-9) return "0";
  const body = Math.abs(n).toLocaleString("vi-VN", {
    maximumFractionDigits: 4,
  });
  return n > 0 ? `+${body}` : `−${body}`;
}

export function formatSignedKRW(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const rounded = Math.round(n);
  const body = new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(Math.abs(rounded));
  if (rounded > 0) return `+${body}`;
  if (rounded < 0) return `−${body}`;
  return body;
}

export function formatInventoryQty(n, { maxFractionDigits = 4 } = {}) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    maximumFractionDigits: maxFractionDigits,
  });
}

export function formatInventoryAmountParts(n, { signed = false } = {}) {
  if (n == null || !Number.isFinite(n) || Math.abs(n) < 1e-9) return null;
  const body = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return {
    sign: signed && n < 0 ? "−" : "",
    body,
  };
}

/** Số tiền pivot: `₩ 380,398.53`; 0 → —. */
export function formatInventoryAmount(n) {
  const parts = formatInventoryAmountParts(n);
  return parts ? `₩ ${parts.body}` : "—";
}

/** Δ tiền pivot: 0 → —; âm kèm ₩ trước số. */
export function formatInventoryAmountDelta(n) {
  const parts = formatInventoryAmountParts(n, { signed: true });
  return parts ? `${parts.sign}₩ ${parts.body}` : "—";
}

/** Δ số lượng pivot: không dấu +, 0 giữ 0. */
export function formatInventoryQtyDelta(n, { maxFractionDigits = 4 } = {}) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) < 1e-9) return "0";
  const body = Math.abs(n).toLocaleString("en-US", {
    maximumFractionDigits: maxFractionDigits,
  });
  return n < 0 ? `−${body}` : body;
}

export function compareMoneyDelta(r) {
  const erpFrom = Number(r?.amountErpFrom) || 0;
  const erpTo = Number(r?.amountErpTo) || 0;
  if (Math.abs(erpFrom) >= 1e-9 || Math.abs(erpTo) >= 1e-9) {
    return erpTo - erpFrom;
  }
  return Number(r?.amountActual) || 0;
}

export function formatPctChange(from, delta) {
  if (!Number.isFinite(from) || Math.abs(from) < 1e-9) return "";
  if (!Number.isFinite(delta) || Math.abs(delta) < 1e-9) return "";
  const pct = (delta / from) * 100;
  const body = Math.abs(pct).toLocaleString("vi-VN", {
    maximumFractionDigits: 1,
  });
  return pct > 0 ? `+${body}%` : `−${body}%`;
}
