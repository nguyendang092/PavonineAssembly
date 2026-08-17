import { memo } from "react";
import DebouncedSearchInput from "@/components/ui/DebouncedSearchInput";

/** Ô tìm HR dùng chung — phép năm, điểm danh, giờ công. */
function HrDebouncedSearchField({
  resetKey,
  onDebouncedChange,
  placeholder,
  className,
}) {
  return (
    <DebouncedSearchInput
      resetKey={resetKey}
      onDebouncedChange={onDebouncedChange}
      placeholder={placeholder}
      className={className}
    />
  );
}

export default memo(HrDebouncedSearchField);
