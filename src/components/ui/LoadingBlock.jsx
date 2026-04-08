import { useTranslation } from "react-i18next";
import LoadingSpinner from "./LoadingSpinner";

/**
 * Khối loading đồng nhất: spinner + chữ (tuỳ chọn).
 * `message={null}` — chỉ hiển thị spinner.
 */
export default function LoadingBlock({
  message,
  subtitle,
  size = "md",
  className = "",
  textClassName = "text-lg font-semibold text-blue-700 dark:text-blue-300",
  subtitleClassName = "text-sm text-slate-500 dark:text-slate-400",
  gapClassName = "gap-3",
}) {
  const { t } = useTranslation();
  const resolvedMessage =
    message === undefined
      ? t("loading.loading")
      : message === null || message === false
        ? null
        : message;

  return (
    <div
      className={`flex flex-col items-center justify-center ${gapClassName} ${className}`}
      role="status"
      aria-busy="true"
    >
      <LoadingSpinner size={size} />
      {resolvedMessage != null && resolvedMessage !== "" ? (
        <p className={`text-center ${textClassName}`}>{resolvedMessage}</p>
      ) : null}
      {subtitle ? (
        <p className={`text-center ${subtitleClassName}`}>{subtitle}</p>
      ) : null}
    </div>
  );
}
