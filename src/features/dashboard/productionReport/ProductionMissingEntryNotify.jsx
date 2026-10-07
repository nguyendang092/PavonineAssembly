import React, { memo, useMemo } from "react";
import NotificationBell from "@/components/ui/NotificationBell";
import { groupMissingProductionEntriesByDate } from "./listMissingProductionProcessEntries";

function ProductionMissingEntryNotify({
  missing = [],
  processLabels = {},
  onSelect,
  rt,
}) {
  const groups = useMemo(
    () => groupMissingProductionEntriesByDate(missing),
    [missing],
  );

  return (
    <div className="s90d-missing-notify">
      <NotificationBell
        inline
        count={missing.length}
        title={rt("missingEntryTitle", "Chưa nhập sản lượng")}
      >
        {missing.length === 0 ? (
          <div className="s90d-missing-notify__empty">
            {rt(
              "missingEntryEmpty",
              "Đã nhập đủ các công đoạn đến hôm nay.",
            )}
          </div>
        ) : (
          <div className="s90d-missing-notify__list">
            <p className="s90d-missing-notify__hint">
              {rt("missingEntryHint", "Bấm một dòng để mở ngày và công đoạn.")}
            </p>
            {groups.map((group) => (
              <div key={group.dateKey} className="s90d-missing-notify__group">
                <div className="s90d-missing-notify__date">{group.dateLabel}</div>
                <div className="s90d-missing-notify__chips">
                  {group.processes.map((item) => (
                    <button
                      key={`${item.dateKey}-${item.process}`}
                      type="button"
                      className="s90d-missing-notify__chip"
                      onClick={() => onSelect?.(item)}
                    >
                      {processLabels[item.process] ?? item.process}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </NotificationBell>
    </div>
  );
}

export default memo(ProductionMissingEntryNotify);
