import React from "react";

export default function S90dBilingualHeader({ ko, vi, compact = false, wrap = false }) {
  const className = [
    "s90d-bilingual-header",
    compact ? "s90d-bilingual-header--compact" : "",
    wrap ? "s90d-bilingual-header--wrap" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      {ko && !compact ? <span className="s90d-th-ko">{ko}</span> : null}
      <span className="s90d-th-vi">{vi}</span>
    </div>
  );
}
