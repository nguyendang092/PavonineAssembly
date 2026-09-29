import React from "react";
import {
  formatInventoryAmountParts,
  formatInventoryQty,
  formatInventoryQtyDelta,
} from "../lib/formatDelta";

export function InventoryDash() {
  return <span className="wah-inv-dash">—</span>;
}

export function InventoryQtyCell({ value, delta = false, fractionDigits }) {
  const opts =
    fractionDigits == null ? undefined : { maxFractionDigits: fractionDigits };
  const text = delta
    ? formatInventoryQtyDelta(value, opts)
    : formatInventoryQty(value, opts);
  if (text === "—") return <InventoryDash />;
  return <span className="wah-inv-qty">{text}</span>;
}

export function InventoryWonCell({ value, signed = false }) {
  const parts = formatInventoryAmountParts(value, { signed });
  if (!parts) return <InventoryDash />;
  return (
    <span className="wah-inv-won">
      {parts.sign ? (
        <span className="wah-inv-won__sign">{parts.sign}</span>
      ) : null}
      <span className="wah-inv-won__mark" title="KRW">
        ₩
      </span>
      <span className="wah-inv-won__n">{parts.body}</span>
    </span>
  );
}
