import React from "react";

export default function S90dBilingualHeader({
  ko,
  vi,
  compact = false,
  wrap = false,
  koBelow = false,
}) {
  const className = [
    "s90d-bilingual-header",
    compact ? "s90d-bilingual-header--compact" : "",
    wrap ? "s90d-bilingual-header--wrap" : "",
    koBelow ? "s90d-bilingual-header--ko-below" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const viNode = <span className="s90d-th-vi">{vi}</span>;
  const koNode = ko && !compact ? <span className="s90d-th-ko">{ko}</span> : null;

  return (
    <div className={className}>
      {koBelow ? (
        <>
          {viNode}
          {koNode}
        </>
      ) : (
        <>
          {koNode}
          {viNode}
        </>
      )}
    </div>
  );
}
